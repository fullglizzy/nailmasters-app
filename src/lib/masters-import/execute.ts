// Импорт проверенных строк в БД.
// Каждый мастер сохраняется отдельной транзакцией: упавшая строка не откатывает
// весь файл, а результат содержит подробный отчёт по каждой строке.

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ScheduleSlotData } from '@/lib/schedule';
import type {
  MasterImportCreatedRow,
  MasterImportFailedRow,
  MasterImportResult,
  MasterImportSkippedRow,
} from '@/lib/types';
import type { ParsedService, ParsedWorkbook } from './parse';

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class RowSkipError extends Error {}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Убирает точные дубликаты и пересечения слотов, сохраняя порядок. */
function mergeSlots(slots: ScheduleSlotData[]): ScheduleSlotData[] {
  const merged: ScheduleSlotData[] = [];

  for (const slot of slots) {
    const start = toMinutes(slot.startTime);
    const end = toMinutes(slot.endTime);

    const overlaps = merged.some((existing) => {
      if (existing.workDate !== slot.workDate) return false;
      const existingStart = toMinutes(existing.startTime);
      const existingEnd = toMinutes(existing.endTime);
      return start < existingEnd && end > existingStart;
    });

    if (!overlaps) merged.push(slot);
  }

  return merged;
}

async function generateUsername(
  tx: DbTransaction,
  usedUsernames: Set<string>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `user_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    if (usedUsernames.has(candidate)) continue;

    const existing = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, candidate))
      .limit(1);

    if (!existing.length) {
      usedUsernames.add(candidate);
      return candidate;
    }
  }

  throw new Error('Не удалось сгенерировать уникальный username');
}

function groupServices(services: ParsedService[]): Map<string, ParsedService[]> {
  const grouped = new Map<string, ParsedService[]>();
  for (const service of services) {
    if (service.status !== 'ready') continue;
    const list = grouped.get(service.phone) ?? [];
    list.push(service);
    grouped.set(service.phone, list);
  }
  return grouped;
}

function groupSlots(parsed: ParsedWorkbook): Map<string, ScheduleSlotData[]> {
  const grouped = new Map<string, ScheduleSlotData[]>();
  for (const schedule of parsed.schedule) {
    if (schedule.status !== 'ready') continue;
    const list = grouped.get(schedule.phone) ?? [];
    list.push(...schedule.slots);
    grouped.set(schedule.phone, list);
  }
  return grouped;
}

export async function executeMasterImport(
  parsed: ParsedWorkbook,
): Promise<MasterImportResult> {
  const created: MasterImportCreatedRow[] = [];
  const skipped: MasterImportSkippedRow[] = [];
  const failed: MasterImportFailedRow[] = [];

  const servicesByPhone = groupServices(parsed.services);
  const slotsByPhone = groupSlots(parsed);

  const usedUsernames = new Set<string>();
  for (const master of parsed.masters) {
    if (master.data?.username) usedUsernames.add(master.data.username);
  }

  const readyMasters = parsed.masters.filter(
    (master) => master.status === 'ready' && master.data,
  );

  for (const master of readyMasters) {
    const data = master.data;
    if (!data) continue;

    const profile = data.profile;
    const phone = data.phone;
    const masterServices = servicesByPhone.get(phone) ?? [];
    const masterSlots = mergeSlots(slotsByPhone.get(phone) ?? []);

    try {
      let userId = '';
      let serviceCount = 0;
      let slotCount = 0;

      await db.transaction(async (tx) => {
        // Повторная проверка внутри транзакции: между предпросмотром и импортом
        // телефон мог занять другой администратор.
        const existing = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.phone, phone))
          .limit(1);

        if (existing.length) {
          throw new RowSkipError('Мастер с таким телефоном уже существует');
        }

        const username = data.username || (await generateUsername(tx, usedUsernames));

        const [newUser] = await tx
          .insert(schema.users)
          .values({
            phone,
            username,
            role: 'nailmaster',
            isGuest: false,
            age: data.age ?? null,
            avatarUrl: null,
          })
          .returning({ id: schema.users.id });

        userId = newUser.id;

        await tx.insert(schema.masterProfiles).values({
          userId,
          fullName: profile.fullName,
          address: profile.address,
          description: profile.description ?? null,
          phone,
          experience: profile.experience,
          city: profile.city,
          specialties: profile.specialties,
          startingPrice: String(profile.startingPrice),
          workFormat: profile.workFormat,
          sterilization: profile.sterilization,
          disposableTools: profile.disposableTools,
          latitude: profile.latitude != null ? String(profile.latitude) : null,
          longitude: profile.longitude != null ? String(profile.longitude) : null,
          isActive: data.isActive,
          isModerated: data.isModerated,
        });

        if (masterServices.length) {
          await tx.insert(schema.masterServices).values(
            masterServices.map((service) => ({
              name: service.name,
              description: service.description ?? null,
              price: String(service.price ?? 0),
              duration: service.duration ?? 0,
              masterId: userId,
            })),
          );
          serviceCount = masterServices.length;
        }

        if (masterSlots.length) {
          await tx.insert(schema.schedules).values(
            masterSlots.map((slot) => ({
              workDate: slot.workDate,
              startTime: slot.startTime,
              endTime: slot.endTime,
              status: 'available',
              masterId: userId,
            })),
          );
          slotCount = masterSlots.length;
        }
      });

      created.push({
        row: master.row,
        userId,
        fullName: profile.fullName,
        phone,
        services: serviceCount,
        slots: slotCount,
      });
    } catch (error) {
      if (error instanceof RowSkipError) {
        skipped.push({
          row: master.row,
          fullName: profile.fullName,
          phone,
          reason: error.message,
        });
        continue;
      }

      const code = (error as { code?: string }).code;
      const message =
        code === '23505'
          ? 'Телефон или username уже заняты другим пользователем'
          : 'Не удалось сохранить мастера';

      logger.error(
        {
          row: master.row,
          phone,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : error,
        },
        'Master import row failed',
      );
      failed.push({
        row: master.row,
        fullName: profile.fullName,
        phone,
        error: message,
      });
    }
  }

  // Строки, которые не дошли до сохранения: дубликаты и строки с ошибками.
  for (const master of parsed.masters) {
    if (master.status === 'duplicate') {
      skipped.push({
        row: master.row,
        fullName: master.display.fullName || '—',
        phone: master.phone || master.display.phone,
        reason: master.warnings[0]?.message ?? 'Мастер уже существует',
      });
    } else if (master.status === 'error') {
      failed.push({
        row: master.row,
        fullName: master.display.fullName || '—',
        phone: master.phone || master.display.phone,
        error: master.errors[0]?.message ?? 'Строка содержит ошибки',
      });
    }
  }

  const byRow = <T extends { row: number }>(items: T[]) =>
    items.slice().sort((a, b) => a.row - b.row);

  return {
    created: byRow(created),
    skipped: byRow(skipped),
    failed: byRow(failed),
    totals: {
      mastersCreated: created.length,
      servicesCreated: created.reduce((sum, item) => sum + item.services, 0),
      slotsCreated: created.reduce((sum, item) => sum + item.slots, 0),
      mastersSkipped: skipped.length,
      mastersFailed: failed.length,
    },
  };
}

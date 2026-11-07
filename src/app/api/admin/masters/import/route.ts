import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, withRateLimit, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import {
  applyExistingRecords,
  buildPreview,
  executeMasterImport,
  ImportFileError,
  MAX_FILE_BYTES,
  parseImportWorkbook,
  type ExistingMasterRecords,
  type ParsedWorkbook,
} from '@/lib/masters-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Проверяет телефоны/username из файла по БД. */
async function loadExistingRecords(parsed: ParsedWorkbook): Promise<ExistingMasterRecords> {
  const phones = [...new Set(parsed.masters.map((master) => master.phone).filter(Boolean))];
  const usernames = [
    ...new Set(
      parsed.masters
        .filter((master) => master.status === 'ready' && master.data?.username)
        .map((master) => master.data!.username!),
    ),
  ];

  const userByPhone = new Map<string, { id: string; role: string; username: string | null }>();
  const profilePhones = new Set<string>();
  const usernameOwners = new Map<string, string>();

  if (phones.length) {
    const users = await db
      .select({
        id: schema.users.id,
        phone: schema.users.phone,
        role: schema.users.role,
        username: schema.users.username,
      })
      .from(schema.users)
      .where(inArray(schema.users.phone, phones));

    for (const user of users) {
      if (user.phone) userByPhone.set(user.phone, user);
    }

    const profiles = await db
      .select({ phone: schema.masterProfiles.phone })
      .from(schema.masterProfiles)
      .where(inArray(schema.masterProfiles.phone, phones));

    for (const profile of profiles) profilePhones.add(profile.phone);
  }

  if (usernames.length) {
    const owners = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(inArray(schema.users.username, usernames));

    for (const owner of owners) {
      if (owner.username) usernameOwners.set(owner.username, owner.id);
    }
  }

  return { userByPhone, profilePhones, usernameOwners };
}

function invalidFileResponse(message: string, status = 422) {
  return errorResponse(message, status);
}

export const POST = withAuth(
  withRateLimit('upload')(async (req: NextRequest) => {
    try {
      const admin = (req as AuthenticatedRequest).user!;
      if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

      // Не читаем в память заведомо огромный запрос.
      const contentLength = Number(req.headers.get('content-length') ?? 0);
      if (contentLength > MAX_FILE_BYTES + 1_000_000) {
        return invalidFileResponse('Файл слишком большой. Максимум — 5 МБ.', 413);
      }

      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return errorResponse('Не удалось прочитать форму загрузки', 400);
      }

      const file = form.get('file');
      if (!file || typeof file === 'string') {
        return errorResponse('Файл не выбран', 400);
      }

      if (file.size === 0) return errorResponse('Файл пустой', 400);
      if (file.size > MAX_FILE_BYTES) {
        return invalidFileResponse('Файл слишком большой. Максимум — 5 МБ.', 413);
      }
      if (!/\.xlsx$/i.test(file.name)) {
        return invalidFileResponse('Поддерживаются только файлы Excel в формате .xlsx');
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return invalidFileResponse(
          'Файл повреждён или не является .xlsx. Сохраните таблицу в формате Excel (.xlsx).',
        );
      }

      const dryRun = form.get('dryRun') === 'true';
      const skipInvalid = form.get('skipInvalid') === 'true';

      let parsed: ParsedWorkbook;
      try {
        parsed = await parseImportWorkbook(buffer);
      } catch (error) {
        if (error instanceof ImportFileError) return invalidFileResponse(error.message);
        throw error;
      }

      const existing = await loadExistingRecords(parsed);
      applyExistingRecords(parsed, existing);
      const preview = buildPreview(parsed);

      if (dryRun) {
        logger.info(
          {
            adminId: admin.userId,
            filename: file.name,
            masters: preview.summary.masterRows,
            readyMasters: preview.summary.readyMasters,
            errorMasters: preview.summary.errorMasters,
            services: preview.summary.serviceRows,
            scheduleRows: preview.summary.scheduleRows,
          },
          'Master import preview',
        );
        return successResponse(preview);
      }

      const hasErrors =
        preview.summary.errorMasters > 0 ||
        preview.summary.errorServices > 0 ||
        preview.summary.errorSchedules > 0;

      if (hasErrors && !skipInvalid) {
        return NextResponse.json(
          {
            success: false,
            error:
              'В файле есть ошибки. Исправьте их и загрузите файл снова или включите импорт корректных строк.',
            data: preview,
          },
          { status: 422 },
        );
      }

      if (preview.summary.readyMasters === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Нет мастеров для импорта: все строки содержат ошибки или уже существуют.',
            data: preview,
          },
          { status: 422 },
        );
      }

      const result = await executeMasterImport(parsed);

      logger.info(
        {
          adminId: admin.userId,
          filename: file.name,
          ...result.totals,
        },
        'Master import completed',
      );

      return successResponse(
        result,
        `Импортировано мастеров: ${result.totals.mastersCreated}`,
        201,
      );
    } catch (error) {
      logger.error(error, 'POST /api/admin/masters/import error');
      return errorResponse('Не удалось выполнить импорт. Попробуйте ещё раз.', 500);
    }
  }),
);

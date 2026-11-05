import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createServiceSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';

// POST /api/admin/masters/[id]/services — добавить услугу мастеру
export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id } = await params;

    const master = await db
      .select({ userId: schema.masterProfiles.userId })
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.userId, id))
      .limit(1);
    if (!master.length) return errorResponse('Мастер не найден', 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);

    const [service] = await db
      .insert(schema.masterServices)
      .values({
        ...parsed.data,
        description: parsed.data.description ?? null,
        price: String(parsed.data.price),
        masterId: id,
      })
      .returning();

    logger.info({ adminId: admin.userId, masterId: id, serviceId: service.id }, 'Master service added by admin');
    return successResponse(service, 'Услуга создана', 201);
  } catch (error) {
    logger.error(error, 'POST /api/admin/masters/[id]/services error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

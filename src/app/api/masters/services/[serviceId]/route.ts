import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { updateServiceSchema } from '@/lib/validators';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { serviceId } = await params;

  const services = await db.select().from(schema.masterServices).where(eq(schema.masterServices.id, serviceId)).limit(1);
  if (!services.length) return errorResponse('Услуга не найдена', 404);
  if (services[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  const body = await req.json();
  const parsed = updateServiceSchema.safeParse(body);
  if (!parsed.success) return errorResponse('Невалидные данные', 422);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svcUpdates: Record<string, any> = { ...parsed.data };
  if (typeof svcUpdates.price === 'number') svcUpdates.price = String(svcUpdates.price);
  await db.update(schema.masterServices).set(svcUpdates).where(eq(schema.masterServices.id, serviceId));
  return successResponse(null, 'Услуга обновлена');
});

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { serviceId } = await params;

  const services = await db.select().from(schema.masterServices).where(eq(schema.masterServices.id, serviceId)).limit(1);
  if (!services.length) return errorResponse('Услуга не найдена', 404);
  if (services[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  await db.delete(schema.masterServices).where(eq(schema.masterServices.id, serviceId));
  return successResponse(null, 'Услуга удалена');
});

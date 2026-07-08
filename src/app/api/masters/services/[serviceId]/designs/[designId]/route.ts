import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { addDesignToServiceSchema } from '@/lib/validators';

export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ serviceId: string; designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { serviceId, designId } = await params;

  const services = await db.select().from(schema.masterServices).where(eq(schema.masterServices.id, serviceId)).limit(1);
  if (!services.length) return errorResponse('Услуга не найдена', 404);
  if (services[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  const body = await req.json().catch(() => ({}));
  const parsed = addDesignToServiceSchema.safeParse(body);

  const [link] = await db.insert(schema.masterServiceDesigns).values({
    masterServiceId: serviceId,
    nailDesignId: designId,
    customPrice: parsed.success ? parsed.data.customPrice?.toString() : null,
    additionalDuration: parsed.success ? parsed.data.additionalDuration : null,
    notes: parsed.success ? parsed.data.notes : null,
  }).returning();

  return successResponse(link, 'Дизайн добавлен к услуге', 201);
});

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ serviceId: string; designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { serviceId, designId } = await params;

  await db.delete(schema.masterServiceDesigns).where(and(
    eq(schema.masterServiceDesigns.masterServiceId, serviceId),
    eq(schema.masterServiceDesigns.nailDesignId, designId),
  ));
  return successResponse(null, 'Дизайн удален из услуги');
});

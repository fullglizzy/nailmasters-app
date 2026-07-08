import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createServiceSchema, updateServiceSchema } from '@/lib/validators';

// GET /api/masters/services — услуги мастера
export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  const services = await db.select().from(schema.masterServices)
    .where(eq(schema.masterServices.masterId, user.userId))
    .orderBy(desc(schema.masterServices.createdAt));
  return successResponse(services);
});

// POST /api/masters/services — создать услугу
export const POST = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

  const body = await req.json();
  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

  const [service] = await db.insert(schema.masterServices).values({
    ...parsed.data,
    price: String(parsed.data.price),
    masterId: user.userId,
  }).returning();

  return successResponse(service, 'Услуга создана', 201);
});

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { updateMasterProfileSchema } from '@/lib/validators';

export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

  const profiles = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, user.userId)).limit(1);
  if (!profiles.length) return errorResponse('Профиль не найден', 404);

  return successResponse(profiles[0]);
});

export const PUT = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

  const body = await req.json();
  const parsed = updateMasterProfileSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

  const updates = { ...parsed.data };
  // Decimal fields must be strings for Drizzle
  const dbUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (['latitude', 'longitude', 'startingPrice', 'rating'].includes(key) && typeof value === 'number') {
      dbUpdates[key] = String(value);
    } else {
      dbUpdates[key] = value;
    }
  }
  await db.update(schema.masterProfiles).set(dbUpdates).where(eq(schema.masterProfiles.userId, user.userId));
  return successResponse(null, 'Профиль обновлен');
});

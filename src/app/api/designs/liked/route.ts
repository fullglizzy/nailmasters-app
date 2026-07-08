import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { successResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;

  const liked = await db
    .select({ nailDesignId: schema.clientLikedDesigns.nailDesignId })
    .from(schema.clientLikedDesigns)
    .where(eq(schema.clientLikedDesigns.clientId, user.userId));

  if (!liked.length) return successResponse([]);

  const designIds = liked.map((l) => l.nailDesignId);
  const designs = await db
    .select()
    .from(schema.nailDesigns)
    .where(inArray(schema.nailDesigns.id, designIds));

  return successResponse(designs);
});

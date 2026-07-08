import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { successResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;

  const existing = await db
    .select()
    .from(schema.clientLikedDesigns)
    .where(and(eq(schema.clientLikedDesigns.clientId, user.userId), eq(schema.clientLikedDesigns.nailDesignId, id)))
    .limit(1);

  return successResponse({ liked: existing.length > 0 });
});

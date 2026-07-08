import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

export async function GET(_req: NextRequest) {
  const designs = await db
    .select()
    .from(schema.nailDesigns)
    .where(eq(schema.nailDesigns.isActive, true))
    .orderBy(desc(schema.nailDesigns.likesCount))
    .limit(20);

  return successResponse(designs);
}

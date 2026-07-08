import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

export async function GET() {
  const masters = await db.select().from(schema.masterProfiles)
    .where(and(eq(schema.masterProfiles.isActive, true), eq(schema.masterProfiles.isModerated, true)))
    .orderBy(desc(schema.masterProfiles.rating))
    .limit(10);

  return successResponse(masters);
}

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ masterId: string }> }) {
  const { masterId } = await params;
  const services = await db.select().from(schema.masterServices).where(eq(schema.masterServices.masterId, masterId));
  return successResponse(services);
}

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profiles = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, id)).limit(1);
  if (!profiles.length) return errorResponse('Мастер не найден', 404);

  const user = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  const services = await db.select().from(schema.masterServices).where(eq(schema.masterServices.masterId, id));

  return successResponse({
    ...profiles[0],
    email: user[0]?.email,
    username: user[0]?.username,
    avatarUrl: user[0]?.avatarUrl,
    services,
  });
}

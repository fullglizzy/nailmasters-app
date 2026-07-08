import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm'; // already has inArray
import { successResponse } from '@/lib/response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ masterId: string }> }) {
  const { masterId } = await params;
  const ratings = await db.select().from(schema.masterRatings).where(eq(schema.masterRatings.nailMasterId, masterId));

  // Enrich with client names + avatars
  const clientIds = [...new Set(ratings.map(r => r.clientId))];
  const clients = clientIds.length > 0
    ? await db.select({ id: schema.users.id, username: schema.users.username, avatarUrl: schema.users.avatarUrl })
        .from(schema.users).where(inArray(schema.users.id, clientIds))
    : [];
  const clientMap = new Map(clients.map(c => [c.id, { name: c.username, avatar: c.avatarUrl }]));

  const enriched = ratings.map(r => ({
    ...r,
    clientName: clientMap.get(r.clientId)?.name || 'Клиент',
    clientAvatar: clientMap.get(r.clientId)?.avatar || null,
  }));
  return successResponse(enriched);
}

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { successResponse, paginatedResponse } from '@/lib/response';
import { masterFiltersSchema } from '@/lib/validators';
import { haversineDistance } from '@/lib/geo';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = masterFiltersSchema.safeParse(raw);

  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(schema.masterProfiles.isActive, true)];

  const masters = await db
    .select()
    .from(schema.masterProfiles)
    .where(and(...conditions))
    .orderBy(desc(schema.masterProfiles.rating))
    .limit(limit)
    .offset(offset);

  // Геолокационная сортировка если переданы координаты
  let result = masters;
  const lat = parsed.success ? parsed.data.latitude : undefined;
  const lon = parsed.success ? parsed.data.longitude : undefined;
  const radius = parsed.success ? parsed.data.radius : 10;

  if (lat != null && lon != null) {
    result = masters
      .map((m) => ({
        ...m,
        distance: m.latitude != null && m.longitude != null
          ? haversineDistance(lat, lon, parseFloat(String(m.latitude)), parseFloat(String(m.longitude)))
          : Infinity,
      }))
      .filter((m) => m.distance <= radius)
      .sort((a, b) => a.distance - b.distance || parseFloat(String(b.rating)) - parseFloat(String(a.rating)));
  }

  // Enrich with avatars from users table
  const userIds = result.map(m => m.userId);
  const users = userIds.length > 0
    ? await db.select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));
  const enriched = result.map(m => ({ ...m, avatarUrl: userMap.get(m.userId)?.avatarUrl || null, username: userMap.get(m.userId)?.username || '' }));

  return paginatedResponse(enriched, { page, limit, total: enriched.length, totalPages: 1 });
}

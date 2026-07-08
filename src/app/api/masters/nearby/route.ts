import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { successResponse } from '@/lib/response';
import { haversineDistance } from '@/lib/geo';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('latitude') || '0');
  const lon = parseFloat(url.searchParams.get('longitude') || '0');
  const radius = parseFloat(url.searchParams.get('radius') || '10');

  const masters = await db.select().from(schema.masterProfiles)
    .where(and(eq(schema.masterProfiles.isActive, true), eq(schema.masterProfiles.isModerated, true)));

  const withDistance = masters
    .map((m) => ({
      ...m,
      distance: m.latitude && m.longitude
        ? haversineDistance(lat, lon, parseFloat(String(m.latitude)), parseFloat(String(m.longitude)))
        : Infinity,
    }))
    .filter((m) => m.distance <= radius)
    .sort((a, b) => a.distance - b.distance || parseFloat(String(b.rating)) - parseFloat(String(a.rating)));

  return successResponse(withDistance);
}

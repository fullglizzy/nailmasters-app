import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { desc, sql, inArray } from 'drizzle-orm';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const [orders, totalResult] = await Promise.all([
    db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.orders),
  ]);

  // Enrich with design info
  const designIds = orders.filter(o => o.nailDesignId).map(o => o.nailDesignId!);
  const snapshotIds = orders.filter(o => o.designSnapshotId).map(o => o.designSnapshotId!);
  const designs = designIds.length > 0
    ? await db.select({ id: schema.nailDesigns.id, title: schema.nailDesigns.title, images: schema.nailDesigns.images }).from(schema.nailDesigns).where(inArray(schema.nailDesigns.id, designIds))
    : [];
  const snapshots = snapshotIds.length > 0
    ? await db.select({ id: schema.orderDesignSnapshots.id, title: schema.orderDesignSnapshots.title, images: schema.orderDesignSnapshots.images }).from(schema.orderDesignSnapshots).where(inArray(schema.orderDesignSnapshots.id, snapshotIds))
    : [];
  const designMap = new Map([...designs, ...snapshots].map(d => [d.id, d]));

  // Enrich with client names
  const clientIds = [...new Set(orders.map(o => o.clientId))];
  const masterIds = [...new Set(orders.map(o => o.nailMasterId))];
  const [clients, masters] = await Promise.all([
    clientIds.length > 0 ? db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, clientIds)) : Promise.resolve([]),
    masterIds.length > 0 ? db.select({ userId: schema.masterProfiles.userId, fullName: schema.masterProfiles.fullName }).from(schema.masterProfiles).where(inArray(schema.masterProfiles.userId, masterIds)) : Promise.resolve([]),
  ]);
  const clientMap = new Map(clients.map(c => [c.id, c.username]));
  const masterMap = new Map(masters.map(m => [m.userId, m.fullName]));

  const enriched = orders.map(o => {
    const designId = o.designSnapshotId || o.nailDesignId;
    const design = designId ? designMap.get(designId) : null;
    return {
      ...o,
      _design: design ? { title: design.title, images: design.images as string[] } : null,
      _clientName: clientMap.get(o.clientId) || '—',
      _masterName: masterMap.get(o.nailMasterId) || '—',
    };
  });

  const total = totalResult[0]?.count ?? 0;
  return paginatedResponse(enriched, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

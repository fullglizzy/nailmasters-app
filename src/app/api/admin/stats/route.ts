import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { NextRequest } from 'next/server';

export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

  const [totalUsers, totalMasters, totalClients, totalDesigns, totalOrders, activeOrders] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.users).then(r => r[0]?.count || 0),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.masterProfiles).then(r => r[0]?.count || 0),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.clientProfiles).then(r => r[0]?.count || 0),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.nailDesigns).where(eq(schema.nailDesigns.isActive, true)).then(r => r[0]?.count || 0),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.orders).then(r => r[0]?.count || 0),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.orders).where(eq(schema.orders.status, 'confirmed')).then(r => r[0]?.count || 0),
  ]);

  return successResponse({
    totalUsers, totalMasters, totalClients, totalDesigns,
    totalOrders, activeOrders,
    totalUploads: totalDesigns,
    revenue: 0,
  });
});

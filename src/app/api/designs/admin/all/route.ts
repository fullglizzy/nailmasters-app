import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { desc, sql } from 'drizzle-orm';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const [designs, totalResult] = await Promise.all([
    db.select().from(schema.nailDesigns).orderBy(desc(schema.nailDesigns.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.nailDesigns),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return paginatedResponse(designs, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

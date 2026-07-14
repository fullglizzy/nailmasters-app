import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { successResponse, paginatedResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { paginationSchema } from '@/lib/validators';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const url = new URL(req.url);
    const parsed = paginationSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search');

    const conditions = [];
    if (search) {
      conditions.push(sql`(${schema.users.email} ILIKE ${`%${search}%`} OR ${schema.users.username} ILIKE ${`%${search}%`})`);
    }

    const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

    const [users, totalResult] = await Promise.all([
      db.select({ id: schema.users.id, email: schema.users.email, username: schema.users.username, role: schema.users.role, isGuest: schema.users.isGuest, blocked: schema.users.blocked, createdAt: schema.users.createdAt })
        .from(schema.users)
        .where(where)
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.users).where(where).then(r => r[0]?.count || 0),
    ]);

    return paginatedResponse(users, { page, limit, total: totalResult, totalPages: Math.ceil(totalResult / limit) });
  } catch (error) {
    logger.error(error, 'GET /api/admin/users error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

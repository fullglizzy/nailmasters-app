import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractToken, type TokenPayload } from './auth';
import { rateLimit, getClientIp } from './rate-limit';
import { AuthError, ForbiddenError } from './errors';
import { errorResponse } from './response';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/db/schema/users';

// Расширенный Request с аутентифицированным пользователем
export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

// RouteHandler с поддержкой типизированных params
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler<P = any> = (
  req: NextRequest,
  context: { params: Promise<P> },
) => Promise<NextResponse>;

// ============================================================
// Middleware: аутентификация (требует JWT)
// ============================================================
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      const token = extractToken(req.headers.get('authorization'));
      if (!token) throw new AuthError('Требуется авторизация');

      const payload = await verifyAccessToken(token);
      if (!payload) throw new AuthError('Токен истек или недействителен');

      // Проверяем, что пользователь существует и не заблокирован
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.userId))
        .limit(1);

      if (!users.length || users[0].blocked) {
        throw new AuthError('Пользователь не найден или заблокирован');
      }

      // Берём роль и isGuest из БД, а не из токена — они могли измениться
      // (например, клиент → мастер, гость → клиент)
      const dbUser = users[0];
      (req as AuthenticatedRequest).user = {
        ...payload,
        role: dbUser.role as UserRole,
        isGuest: dbUser.isGuest,
      };
      return handler(req, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return errorResponse(error.message, error.statusCode);
      }
      throw error;
    }
  };
}

// ============================================================
// Middleware: проверка роли
// ============================================================
export function withRole(...roles: UserRole[]) {
  return (handler: RouteHandler): RouteHandler => {
    return withAuth(async (req, context) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user || !roles.includes(user.role)) {
        return errorResponse('Недостаточно прав', 403);
      }
      return handler(req, context);
    });
  };
}

// ============================================================
// Middleware: опциональная аутентификация
// ============================================================
export function withOptionalAuth(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const token = extractToken(req.headers.get('authorization'));
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload) {
        // Сверяем роль и isGuest с БД — они могли измениться с момента выпуска токена
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, payload.userId))
          .limit(1);
        if (users.length && !users[0].blocked) {
          (req as AuthenticatedRequest).user = {
            ...payload,
            role: users[0].role as UserRole,
            isGuest: users[0].isGuest,
          };
        }
      }
    }
    return handler(req, context);
  };
}

// ============================================================
// Middleware: rate limiting
// ============================================================
export function withRateLimit(
  type: 'default' | 'auth' | 'upload' | 'search' = 'default',
) {
  return (handler: RouteHandler): RouteHandler => {
    return async (req, context) => {
      try {
        const ip = getClientIp(req);
        await rateLimit(ip, type);
      } catch (error) {
        if (error instanceof Error) {
          return errorResponse(error.message, 429);
        }
      }
      return handler(req, context);
    };
  };
}

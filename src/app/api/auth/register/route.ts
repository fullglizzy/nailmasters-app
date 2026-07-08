import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, or, sql } from 'drizzle-orm';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie, verifyAccessToken, extractToken } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const { email, username, password, role, fullName, phone, age } = parsed.data;

    // Check if converting from guest account
    const authHeader = req.headers.get('authorization');
    const guestToken = extractToken(authHeader);
    let guestUser: typeof schema.users.$inferSelect | null = null;
    if (guestToken) {
      const guestPayload = await verifyAccessToken(guestToken);
      if (guestPayload?.isGuest) {
        const guest = await db.select().from(schema.users).where(eq(schema.users.id, guestPayload.userId)).limit(1);
        if (guest.length > 0 && guest[0].isGuest) {
          guestUser = guest[0];
        }
      }
    }

    const passwordHash = await hashPassword(password);

    if (guestUser) {
      // Convert guest: UPDATE existing user record — keeps all likes, comments, uploads
      const [user] = await db.update(schema.users).set({
        email, username, password: passwordHash, role, isGuest: false, age,
      }).where(eq(schema.users.id, guestUser.id)).returning();

      // Update/create profile
      if (role === 'nailmaster') {
        await db.insert(schema.masterProfiles).values({
          userId: user.id, fullName: fullName || username, phone: phone || '',
        }).onConflictDoUpdate({ target: schema.masterProfiles.userId, set: { fullName: fullName || username, phone: phone || '' } });
      } else {
        await db.update(schema.clientProfiles).set({
          fullName: fullName || null, phone: phone || null,
        }).where(eq(schema.clientProfiles.userId, user.id));
      }

      // Transfer guest likes from localStorage to DB
      const guestLikeIds: string[] = body.guestLikeIds || [];
      if (guestLikeIds.length > 0) {
        for (const designId of guestLikeIds) {
          await db.insert(schema.clientLikedDesigns).values({ clientId: user.id, nailDesignId: designId }).onConflictDoNothing();
          await db.update(schema.nailDesigns).set({ likesCount: sql`${schema.nailDesigns.likesCount} + 1` }).where(eq(schema.nailDesigns.id, designId));
        }
      }

      logger.info({ userId: user.id, role }, 'Guest converted to registered user');

      const tokenPayload = {
        userId: user.id, email: user.email, username: user.username,
        role: user.role as 'admin' | 'nailmaster' | 'client', isGuest: false,
        fullName: fullName || null, phone: phone || null, avatar: user.avatarUrl || null,
      };
      const token = await generateAccessToken(tokenPayload);
      const refreshToken = await generateRefreshToken(user.id);
      await setRefreshTokenCookie(refreshToken);

      return successResponse({
        user: { id: user.id, email: user.email, username: user.username, role: user.role, isGuest: false, fullName: fullName || null, phone: phone || null, avatar: user.avatarUrl || null },
        token, refreshToken,
      }, 'Аккаунт создан, все данные сохранены', 201);
    }

    // Regular registration (new user)
    const existing = await db.select({ id: schema.users.id }).from(schema.users)
      .where(or(eq(schema.users.email, email), eq(schema.users.username, username))).limit(1);
    if (existing.length > 0) return errorResponse('Пользователь с таким email или username уже существует', 409);

    if (phone && role === 'nailmaster') {
      const existingPhone = await db.select({ userId: schema.masterProfiles.userId })
        .from(schema.masterProfiles).where(eq(schema.masterProfiles.phone, phone)).limit(1);
      if (existingPhone.length > 0) return errorResponse('Мастер с таким телефоном уже существует', 409);
    }

    const [user] = await db.insert(schema.users).values({ email, username, password: passwordHash, role, age }).returning();

    if (role === 'nailmaster') {
      await db.insert(schema.masterProfiles).values({ userId: user.id, fullName: fullName || username, phone: phone || '' });
    } else {
      await db.insert(schema.clientProfiles).values({ userId: user.id, fullName: fullName || null, phone: phone || null });
    }

    logger.info({ userId: user.id, role }, 'User registered');

    const tokenPayload = {
      userId: user.id, email: user.email, username: user.username,
      role: user.role as 'admin' | 'nailmaster' | 'client', isGuest: user.isGuest,
      fullName: fullName || null, phone: phone || null, avatar: user.avatarUrl || null,
    };
    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse({
      user: { id: user.id, email: user.email, username: user.username, role: user.role, isGuest: user.isGuest, fullName: fullName || null, phone: phone || null, avatar: user.avatarUrl || null },
      token, refreshToken,
    }, 'Регистрация успешна', 201);
  } catch (error) {
    logger.error(error, 'Register error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, or, sql } from 'drizzle-orm';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie, verifyAccessToken, extractToken } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const { phone, password, role, fullName } = parsed.data;

    // Normalize phone
    const normalizedPhone = phone.replace(/[\s()\-]/g, '');

    // Check if converting from guest account
    const authHeader = req.headers.get('authorization');
    const guestToken = extractToken(authHeader);
    let guestUser: typeof schema.users.$inferSelect | null = null;
    if (guestToken) {
      const guestPayload = await verifyAccessToken(guestToken);
      if (guestPayload?.isGuest) {
        const guest = await db.select().from(schema.users).where(eq(schema.users.id, guestPayload.userId)).limit(1);
        if (guest.length > 0 && guest[0].isGuest) guestUser = guest[0];
      }
    }

    // Check phone uniqueness
    const existingPhone = await db.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.phone, normalizedPhone)).limit(1);
    if (existingPhone.length > 0 && existingPhone[0].id !== guestUser?.id) {
      return errorResponse('Пользователь с таким телефоном уже существует', 409);
    }

    const passwordHash = await hashPassword(password);
    const username = `user_${uuid().slice(0, 8)}`; // auto-generated username

    if (guestUser) {
      // Convert guest
      const [user] = await db.update(schema.users).set({
        phone: normalizedPhone, username, password: passwordHash, role, isGuest: false,
      }).where(eq(schema.users.id, guestUser.id)).returning();

      if (role === 'nailmaster') {
        await db.insert(schema.masterProfiles).values({
          userId: user.id, fullName, phone: normalizedPhone,
        }).onConflictDoUpdate({ target: schema.masterProfiles.userId, set: { fullName, phone: normalizedPhone } });
      } else {
        await db.insert(schema.clientProfiles).values({
          userId: user.id, fullName, phone: normalizedPhone,
        }).onConflictDoUpdate({ target: schema.clientProfiles.userId, set: { fullName, phone: normalizedPhone } });
      }

      // Transfer guest likes
      const guestLikeIds: string[] = body.guestLikeIds || [];
      for (const designId of guestLikeIds) {
        await db.insert(schema.clientLikedDesigns).values({ clientId: user.id, nailDesignId: designId }).onConflictDoNothing();
        await db.update(schema.nailDesigns).set({ likesCount: sql`${schema.nailDesigns.likesCount} + 1` }).where(eq(schema.nailDesigns.id, designId));
      }

      logger.info({ userId: user.id, role }, 'Guest converted');

      const tokenPayload = buildTokenPayload(user, fullName, normalizedPhone);
      const token = await generateAccessToken(tokenPayload);
      const refreshToken = await generateRefreshToken(user.id);
      await setRefreshTokenCookie(refreshToken);

      return successResponse({
        user: { id: user.id, phone: user.phone, username: user.username, role: user.role, isGuest: false, fullName, avatar: user.avatarUrl },
        token, refreshToken,
      }, 'Аккаунт создан', 201);
    }

    // New user
    const [user] = await db.insert(schema.users).values({
      phone: normalizedPhone, username, password: passwordHash, role,
    }).returning();

    if (role === 'nailmaster') {
      await db.insert(schema.masterProfiles).values({ userId: user.id, fullName, phone: normalizedPhone });
    } else {
      await db.insert(schema.clientProfiles).values({ userId: user.id, fullName, phone: normalizedPhone });
    }

    logger.info({ userId: user.id, role }, 'User registered');

    const tokenPayload = buildTokenPayload(user, fullName, normalizedPhone);
    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse({
      user: { id: user.id, phone: user.phone, username: user.username, role: user.role, isGuest: false, fullName, avatar: user.avatarUrl },
      token, refreshToken,
    }, 'Регистрация успешна', 201);
  } catch (error) {
    logger.error(error, 'Register error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

function buildTokenPayload(user: typeof schema.users.$inferSelect, fullName: string, phone: string) {
  return {
    userId: user.id,
    email: user.email || '',
    username: user.username || '',
    role: user.role as 'admin' | 'nailmaster' | 'client',
    isGuest: user.isGuest,
    fullName,
    phone: phone || user.phone || '',
    avatar: user.avatarUrl,
  };
}

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, sql, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { nanoid } from 'nanoid';

// POST /api/designs/:id/like/public — лайк для гостей (с авто-регистрацией)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const designs = await db.select({ id: schema.nailDesigns.id }).from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    if (!designs.length) return errorResponse('Дизайн не найден', 404);

    // Auto-create guest account
    const guestEmail = `guest_${Date.now()}_${nanoid(6)}@temp.nailmasters.com`;
    const guestPassword = nanoid(16);
    const passwordHash = await hashPassword(guestPassword);

    const [guest] = await db.insert(schema.users).values({
      email: guestEmail, username: `Гость ${Math.floor(1000 + Math.random() * 9000)}`,
      password: passwordHash, role: 'client', isGuest: true,
    }).returning();

    await db.insert(schema.clientProfiles).values({ userId: guest.id }).onConflictDoNothing();

    // Insert into junction table (toggle)
    const existing = await db.select().from(schema.clientLikedDesigns)
      .where(and(eq(schema.clientLikedDesigns.clientId, guest.id), eq(schema.clientLikedDesigns.nailDesignId, id)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(schema.clientLikedDesigns)
        .where(and(eq(schema.clientLikedDesigns.clientId, guest.id), eq(schema.clientLikedDesigns.nailDesignId, id)));
      await db.update(schema.nailDesigns).set({ likesCount: sql`GREATEST(${schema.nailDesigns.likesCount} - 1, 0)` }).where(eq(schema.nailDesigns.id, id));
    } else {
      await db.insert(schema.clientLikedDesigns).values({ clientId: guest.id, nailDesignId: id });
      await db.update(schema.nailDesigns).set({ likesCount: sql`${schema.nailDesigns.likesCount} + 1` }).where(eq(schema.nailDesigns.id, id));
    }

    const token = await generateAccessToken({ userId: guest.id, email: guest.email, username: guest.username, role: 'client', isGuest: true });
    const refreshToken = await generateRefreshToken(guest.id);
    await setRefreshTokenCookie(refreshToken);

    const countResult = await db.select({ likesCount: schema.nailDesigns.likesCount }).from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    return successResponse({ liked: true, likesCount: countResult[0]?.likesCount ?? 0, token, refreshToken, user: { id: guest.id, username: guest.username, isGuest: true } });
  } catch {
    return errorResponse('Ошибка обработки лайка', 500);
  }
}

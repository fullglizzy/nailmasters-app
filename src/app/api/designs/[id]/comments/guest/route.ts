import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/response';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const text = body.text;

  if (!text || typeof text !== 'string') return errorResponse('Текст обязателен', 422);

  // Auto-create guest account
  const guestEmail = `guest_${Date.now()}_${nanoid(6)}@temp.nailmasters.com`;
  const guestPassword = nanoid(16);
  const passwordHash = await hashPassword(guestPassword);

  const [guest] = await db.insert(schema.users).values({
    email: guestEmail, username: `Гость ${Math.floor(1000 + Math.random() * 9000)}`,
    password: passwordHash, role: 'client', isGuest: true,
  }).returning();

  await db.insert(schema.clientProfiles).values({ userId: guest.id }).onConflictDoNothing();

  const [comment] = await db.insert(schema.comments).values({
    text, authorId: guest.id, designId: id,
    parentCommentId: body.parentCommentId || null,
  }).returning();

  const token = await generateAccessToken({ userId: guest.id, email: guest.email, username: guest.username, role: 'client', isGuest: true });
  const refreshToken = await generateRefreshToken(guest.id);
  await setRefreshTokenCookie(refreshToken);

  return successResponse({ comment, token, refreshToken, user: { id: guest.id, username: guest.username, isGuest: true } }, 'Комментарий добавлен', 201);
}

import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, or, desc, asc, sql, inArray, ne } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

const createMessageSchema = z.object({
  text: z.string().min(1, 'Текст обязателен').max(5000),
  receiverId: z.string().uuid('Некорректный ID получателя'),
  attachments: z.array(z.any()).optional(),
  replyToId: z.string().uuid().optional(),
});

// GET /api/messages — список диалогов, сообщения с пользователем, или только счётчик непрочитанных
export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  const url = new URL(req.url);
  const withUserId = url.searchParams.get('with');

  // ?unread=1 — только общее количество непрочитанных
  if (url.searchParams.get('unread') === '1') {
    const result = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(schema.messages)
      .where(and(
        eq(schema.messages.receiverId, user.userId),
        eq(schema.messages.isRead, false),
      )!);
    return successResponse({ total: result[0]?.total ?? 0 });
  }

  if (withUserId) {
    // Переписка с конкретным пользователем
    const msgs = await db
      .select()
      .from(schema.messages)
      .where(
        or(
          and(eq(schema.messages.senderId, user.userId), eq(schema.messages.receiverId, withUserId)),
          and(eq(schema.messages.senderId, withUserId), eq(schema.messages.receiverId, user.userId)),
        )!
      )
      .orderBy(asc(schema.messages.createdAt))
      .limit(100);

    // Mark as read
    await db
      .update(schema.messages)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.messages.receiverId, user.userId),
          eq(schema.messages.senderId, withUserId),
          eq(schema.messages.isRead, false),
        )!
      );

    return successResponse(msgs);
  }

  // Список диалогов: последнее сообщение с каждым пользователем
  const allUserMsgs = await db
    .select()
    .from(schema.messages)
    .where(
      or(
        eq(schema.messages.senderId, user.userId),
        eq(schema.messages.receiverId, user.userId),
      )!
    )
    .orderBy(desc(schema.messages.createdAt));

  // Группируем по собеседнику, берём последнее сообщение
  const convMap = new Map<string, (typeof allUserMsgs)[number]>();
  for (const m of allUserMsgs) {
    const otherId = m.senderId === user.userId ? m.receiverId : m.senderId;
    if (!convMap.has(otherId)) convMap.set(otherId, m);
  }

  // Получаем имена собеседников
  const otherIds = [...convMap.keys()];
  const users = otherIds.length > 0
    ? await db
        .select({ id: schema.users.id, username: schema.users.username, avatarUrl: schema.users.avatarUrl })
        .from(schema.users)
        .where(inArray(schema.users.id, otherIds))
    : [];

  const masterIds = otherIds.length > 0
    ? await db
        .select({ userId: schema.masterProfiles.userId, fullName: schema.masterProfiles.fullName })
        .from(schema.masterProfiles)
        .where(inArray(schema.masterProfiles.userId, otherIds))
    : [];

  const clientIds = otherIds.length > 0
    ? await db
        .select({ userId: schema.clientProfiles.userId, fullName: schema.clientProfiles.fullName })
        .from(schema.clientProfiles)
        .where(inArray(schema.clientProfiles.userId, otherIds))
    : [];

  const nameMap = new Map<string, string>();
  const avatarMap = new Map<string, string | null>();
  users.forEach(u => { nameMap.set(u.id, u.username || ''); avatarMap.set(u.id, u.avatarUrl); });
  masterIds.forEach(m => nameMap.set(m.userId, m.fullName || nameMap.get(m.userId) || ''));
  clientIds.forEach(c => nameMap.set(c.userId, c.fullName || nameMap.get(c.userId) || ''));

  // Unread counts
  const unreadCounts = otherIds.length > 0
    ? await db
        .select({
          senderId: schema.messages.senderId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.receiverId, user.userId),
            eq(schema.messages.isRead, false),
            inArray(schema.messages.senderId, otherIds),
          )!
        )
        .groupBy(schema.messages.senderId)
    : [];

  const unreadMap = new Map<string, number>();
  unreadCounts.forEach(r => unreadMap.set(r.senderId, r.count));

  const conversations = [...convMap.entries()].map(([otherId, lastMsg]) => ({
    userId: otherId,
    name: nameMap.get(otherId) || 'Пользователь',
    avatarUrl: avatarMap.get(otherId) || null,
    lastMessage: lastMsg.text.slice(0, 100),
    lastTime: lastMsg.createdAt,
    unread: unreadMap.get(otherId) || (lastMsg.senderId === otherId && !lastMsg.isRead ? 1 : 0),
    isMine: lastMsg.senderId === user.userId,
  }));

  // Sort by last time
  conversations.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

  return successResponse(conversations);
});

// POST /api/messages — отправить сообщение
export const POST = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  const body = await req.json();
  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

  const [msg] = await db
    .insert(schema.messages)
    .values({
      id: uuid(),
      text: parsed.data.text.trim().slice(0, 5000),
      senderId: user.userId,
      receiverId: parsed.data.receiverId,
      relatedOrderId: body.relatedOrderId || null,
      attachments: parsed.data.attachments || null,
      replyToId: parsed.data.replyToId || null,
      replyToText: body.replyToText || null,
      replyToSenderName: body.replyToSenderName || null,
    })
    .returning();

  return successResponse(msg, 'Отправлено', 201);
});

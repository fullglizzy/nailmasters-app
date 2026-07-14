import { pgTable, uuid, text, boolean, timestamp, jsonb, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { orders } from './orders';

// ============================================================
// messages — личные сообщения между пользователями
// ============================================================
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  text: text('text').notNull().default(''),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  relatedOrderId: uuid('related_order_id').references(() => orders.id, { onDelete: 'set null' }),
  attachmentUrl: text('attachment_url'),
  attachments: jsonb('attachments').$type<{ url: string; type: string }[]>(),
  replyToId: uuid('reply_to_id').references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
  replyToText: text('reply_to_text'),
  replyToSenderName: text('reply_to_sender_name'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  isEdited: boolean('is_edited').default(false).notNull(),
  editedAt: timestamp('edited_at'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  senderIdx: index('idx_messages_sender').on(table.senderId),
  receiverIdx: index('idx_messages_receiver').on(table.receiverId),
  createdIdx: index('idx_messages_created').on(table.createdAt),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'message_sender',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'message_receiver',
  }),
  relatedOrder: one(orders, {
    fields: [messages.relatedOrderId],
    references: [orders.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: 'message_reply',
  }),
}));

import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { orders } from './orders';

// Типы уведомлений
export const NOTIFICATION_TYPES = [
  'order_created', 'order_confirmed', 'order_declined',
  'order_timeout', 'alternative_time_proposed', 'rating_decreased',
  'new_design_uploaded', 'new_comment', 'new_review',
  'master_response', 'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ============================================================
// notifications — уведомления пользователей
// ============================================================
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull().$type<NotificationType>(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  isSent: boolean('is_sent').default(false).notNull(),
  metadata: jsonb('metadata'),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  relatedOrderId: uuid('related_order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
  }),
  relatedOrder: one(orders, {
    fields: [notifications.relatedOrderId],
    references: [orders.id],
  }),
}));

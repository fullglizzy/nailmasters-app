import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { nailDesigns } from './designs';

// ============================================================
// comments — комментарии к дизайнам
// ============================================================
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  text: text('text').notNull(),
  parentCommentId: uuid('parent_comment_id'),
  likesCount: integer('likes_count').default(0).notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  designId: uuid('design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  design: one(nailDesigns, {
    fields: [comments.designId],
    references: [nailDesigns.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: 'comment_replies',
  }),
  replies: many(comments, { relationName: 'comment_replies' }),
}));

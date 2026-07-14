import { pgTable, uuid, text, integer, timestamp, primaryKey, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, clientProfiles } from './users';
import { nailDesigns } from './designs';

// ============================================================
// comments — комментарии к дизайнам
// ============================================================
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  text: text('text').notNull(),
  parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
  likesCount: integer('likes_count').default(0).notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  designId: uuid('design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  designIdx: index('idx_comments_design').on(table.designId),
  authorIdx: index('idx_comments_author').on(table.authorId),
}));

// ============================================================
// comment_likes — кто лайкнул какой комментарий
// ============================================================
export const commentLikes = pgTable('comment_likes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.commentId] }),
}));

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
  likes: many(commentLikes),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  user: one(users, { fields: [commentLikes.userId], references: [users.id] }),
  comment: one(comments, { fields: [commentLikes.commentId], references: [comments.id] }),
}));

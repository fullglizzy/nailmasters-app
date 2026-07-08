import { pgTable, uuid, text, integer, varchar, boolean, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clientProfiles, masterProfiles } from './users';
import { nailDesigns } from './designs';

// ============================================================
// reviews — отзывы на дизайны
// ============================================================
export const reviews = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  comment: text('comment').notNull(),
  rating: integer('rating'),
  imageUrl: varchar('image_url', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  clientId: uuid('client_id').notNull().references(() => clientProfiles.userId, { onDelete: 'cascade' }),
  nailDesignId: uuid('nail_design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
  nailMasterId: uuid('nail_master_id').references(() => masterProfiles.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// master_ratings — рейтинг мастеров (числовые оценки)
// ============================================================
export const masterRatings = pgTable('master_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ratingNumber: integer('rating_number').notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: date('created_at').defaultNow().notNull(),
  nailMasterId: uuid('nail_master_id').notNull().references(() => masterProfiles.userId, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clientProfiles.userId, { onDelete: 'cascade' }),
});

// ============================================================
// Relations
// ============================================================
export const reviewsRelations = relations(reviews, ({ one }) => ({
  client: one(clientProfiles, {
    fields: [reviews.clientId],
    references: [clientProfiles.userId],
  }),
  nailDesign: one(nailDesigns, {
    fields: [reviews.nailDesignId],
    references: [nailDesigns.id],
  }),
  nailMaster: one(masterProfiles, {
    fields: [reviews.nailMasterId],
    references: [masterProfiles.userId],
  }),
}));

export const masterRatingsRelations = relations(masterRatings, ({ one }) => ({
  nailMaster: one(masterProfiles, {
    fields: [masterRatings.nailMasterId],
    references: [masterProfiles.userId],
  }),
  client: one(clientProfiles, {
    fields: [masterRatings.clientId],
    references: [clientProfiles.userId],
  }),
}));

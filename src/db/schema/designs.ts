import { pgTable, uuid, varchar, text, jsonb, integer, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, clientProfiles, masterProfiles, adminProfiles } from './users';

// Enums
export const designTypeEnum = pgEnum('design_type', ['basic', 'designer']);
export const designSourceEnum = pgEnum('design_source', ['admin', 'client', 'master']);
export const nailLengthEnum = pgEnum('nail_length', ['short', 'medium', 'long']);
export const nailShapeEnum = pgEnum('nail_shape', ['square', 'soft_square', 'almond', 'oval', 'stiletto', 'ballerina']);
export const seasonEnum = pgEnum('season', ['spring', 'summer', 'fall', 'winter']);
export const serviceFormatEnum = pgEnum('service_format', ['salon', 'home', 'both']);

// ============================================================
// nail_designs — центральная таблица каталога дизайнов
// ============================================================
export const nailDesigns = pgTable('nail_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  images: jsonb('images').$type<string[]>().notNull(),
  videoUrl: varchar('video_url', { length: 500 }),
  type: varchar('type', { length: 50 }).default('basic').notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  tags: jsonb('tags').$type<string[]>(),
  color: varchar('color', { length: 100 }),
  colors: jsonb('colors').$type<{ hex: string; lab: number[] }[]>(),
  techniques: jsonb('techniques').$type<string[]>(),
  length: varchar('length', { length: 50 }),
  shape: varchar('shape', { length: 50 }),
  occasionTags: jsonb('occasion_tags').$type<string[]>(),
  moodTags: jsonb('mood_tags').$type<string[]>(),
  materials: jsonb('materials').$type<string[]>(),
  decorTags: jsonb('decor_tags').$type<string[]>(),
  durationMinutes: integer('duration_minutes'),
  season: varchar('season', { length: 50 }),
  trendTags: jsonb('trend_tags').$type<string[]>(),
  serviceFormat: varchar('service_format', { length: 50 }),
  likesCount: integer('likes_count').default(0).notNull(),
  ordersCount: integer('orders_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isModerated: boolean('is_moderated').default(false).notNull(),
  minPrice: decimal('min_price', { precision: 10, scale: 2 }),
  uploadedByClientId: uuid('uploaded_by_client_id').references(() => clientProfiles.userId, { onDelete: 'set null' }),
  uploadedByAdminId: uuid('uploaded_by_admin_id').references(() => adminProfiles.userId, { onDelete: 'set null' }),
  uploadedByMasterId: uuid('uploaded_by_master_id').references(() => masterProfiles.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// master_designs — «Я так могу» связь мастера с дизайном (старая система)
// ============================================================
export const masterDesigns = pgTable('master_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  customPrice: decimal('custom_price', { precision: 10, scale: 2 }),
  notes: text('notes'),
  estimatedDuration: integer('estimated_duration'),
  isActive: boolean('is_active').default(true).notNull(),
  nailMasterId: uuid('nail_master_id').notNull().references(() => masterProfiles.userId, { onDelete: 'cascade' }),
  nailDesignId: uuid('nail_design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// ============================================================
// client_liked_designs — junction table
// ============================================================
export const clientLikedDesigns = pgTable('client_liked_designs', {
  clientId: uuid('client_id').notNull().references(() => clientProfiles.userId, { onDelete: 'cascade' }),
  nailDesignId: uuid('nail_design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
});

// ============================================================
// Relations
// ============================================================
export const nailDesignsRelations = relations(nailDesigns, ({ one, many }) => ({
  uploadedByClient: one(clientProfiles, {
    fields: [nailDesigns.uploadedByClientId],
    references: [clientProfiles.userId],
  }),
  uploadedByAdmin: one(adminProfiles, {
    fields: [nailDesigns.uploadedByAdminId],
    references: [adminProfiles.userId],
  }),
  uploadedByMaster: one(masterProfiles, {
    fields: [nailDesigns.uploadedByMasterId],
    references: [masterProfiles.userId],
  }),
  likedByClients: many(clientLikedDesigns),
  canDoMasters: many(masterDesigns),
  serviceDesigns: many(import('./services').then(m => m.masterServiceDesigns) as never),
  orders: many(import('./orders').then(m => m.orders) as never),
  reviews: many(import('./reviews').then(m => m.reviews) as never),
  comments: many(import('./comments').then(m => m.comments) as never),
}));

export const masterDesignsRelations = relations(masterDesigns, ({ one }) => ({
  nailMaster: one(masterProfiles, {
    fields: [masterDesigns.nailMasterId],
    references: [masterProfiles.userId],
  }),
  nailDesign: one(nailDesigns, {
    fields: [masterDesigns.nailDesignId],
    references: [nailDesigns.id],
  }),
}));

export const clientLikedDesignsRelations = relations(clientLikedDesigns, ({ one }) => ({
  client: one(clientProfiles, {
    fields: [clientLikedDesigns.clientId],
    references: [clientProfiles.userId],
  }),
  nailDesign: one(nailDesigns, {
    fields: [clientLikedDesigns.nailDesignId],
    references: [nailDesigns.id],
  }),
}));

import { pgTable, uuid, varchar, text, integer, boolean, decimal, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { masterProfiles } from './users';
import { nailDesigns } from './designs';

// ============================================================
// master_services — услуги мастера
// ============================================================
export const masterServices = pgTable('master_services', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  masterId: uuid('master_id').notNull().references(() => masterProfiles.userId, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// master_service_designs — привязка дизайнов к услугам (новая система)
// ============================================================
export const masterServiceDesigns = pgTable('master_service_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  customPrice: decimal('custom_price', { precision: 10, scale: 2 }),
  additionalDuration: integer('additional_duration'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  masterServiceId: uuid('master_service_id').notNull().references(() => masterServices.id, { onDelete: 'cascade' }),
  nailDesignId: uuid('nail_design_id').notNull().references(() => nailDesigns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// Relations
// ============================================================
export const masterServicesRelations = relations(masterServices, ({ one, many }) => ({
  master: one(masterProfiles, {
    fields: [masterServices.masterId],
    references: [masterProfiles.userId],
  }),
  designs: many(masterServiceDesigns),
  orders: many(import('./orders').then(m => m.orders) as never),
}));

export const masterServiceDesignsRelations = relations(masterServiceDesigns, ({ one }) => ({
  masterService: one(masterServices, {
    fields: [masterServiceDesigns.masterServiceId],
    references: [masterServices.id],
  }),
  nailDesign: one(nailDesigns, {
    fields: [masterServiceDesigns.nailDesignId],
    references: [nailDesigns.id],
  }),
}));

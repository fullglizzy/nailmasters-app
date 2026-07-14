import { pgTable, uuid, varchar, text, integer, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clientProfiles, masterProfiles } from './users';
import { nailDesigns } from './designs';
import { masterServices } from './services';

// Статусы заказа
export const ORDER_STATUS = [
  'pending', 'confirmed', 'alternative_proposed',
  'declined', 'timeout', 'completed', 'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

// ============================================================
// order_design_snapshots — снимок дизайна на момент заказа
// ============================================================
export const orderDesignSnapshots = pgTable('order_design_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  images: jsonb('images').$type<string[]>().notNull(),
  videoUrl: varchar('video_url', { length: 500 }),
  type: varchar('type', { length: 50 }).default('basic').notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  tags: jsonb('tags').$type<string[]>(),
  color: varchar('color', { length: 100 }),
  originalDesignId: varchar('original_design_id', { length: 255 }),
  authorName: varchar('author_name', { length: 255 }),
  authorId: varchar('author_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// orders — заказы/бронирования
// ============================================================
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  price: decimal('price', { precision: 10, scale: 2 }),
  requestedDateTime: timestamp('requested_date_time').notNull(),
  proposedDateTime: timestamp('proposed_date_time'),
  confirmedDateTime: timestamp('confirmed_date_time'),
  masterNotes: text('master_notes'),
  clientNotes: text('client_notes'),
  masterResponseTime: timestamp('master_response_time'),
  completedAt: timestamp('completed_at'),
  completedBy: varchar('completed_by', { length: 20 }),
  rating: integer('rating'),
  additionalDuration: integer('additional_duration'),
  clientId: uuid('client_id').notNull().references(() => clientProfiles.userId, { onDelete: 'cascade' }),
  nailMasterId: uuid('nail_master_id').notNull().references(() => masterProfiles.userId, { onDelete: 'cascade' }),
  masterServiceId: uuid('master_service_id').references(() => masterServices.id),
  serviceIds: jsonb('service_ids').$type<string[]>(),
  nailDesignId: uuid('nail_design_id').references(() => nailDesigns.id, { onDelete: 'set null' }),
  designSnapshotId: uuid('design_snapshot_id').references(() => orderDesignSnapshots.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  clientIdx: index('idx_orders_client').on(table.clientId),
  masterIdx: index('idx_orders_master').on(table.nailMasterId),
  statusIdx: index('idx_orders_status').on(table.status),
  createdIdx: index('idx_orders_created').on(table.createdAt),
}));

// ============================================================
// Relations
// ============================================================
export const ordersRelations = relations(orders, ({ one }) => ({
  client: one(clientProfiles, {
    fields: [orders.clientId],
    references: [clientProfiles.userId],
  }),
  nailMaster: one(masterProfiles, {
    fields: [orders.nailMasterId],
    references: [masterProfiles.userId],
  }),
  masterService: one(masterServices, {
    fields: [orders.masterServiceId],
    references: [masterServices.id],
  }),
  nailDesign: one(nailDesigns, {
    fields: [orders.nailDesignId],
    references: [nailDesigns.id],
  }),
  designSnapshot: one(orderDesignSnapshots, {
    fields: [orders.designSnapshotId],
    references: [orderDesignSnapshots.id],
  }),
}));

export const orderDesignSnapshotsRelations = relations(orderDesignSnapshots, ({ many }) => ({
  orders: many(orders),
}));

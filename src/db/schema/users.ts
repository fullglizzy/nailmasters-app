import { pgTable, uuid, varchar, boolean, timestamp, integer, decimal, text, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'nailmaster', 'client']);
export const workFormatEnum = pgEnum('work_format', ['salon', 'home', 'both']);

// Базовые права доступа
export type UserRole = 'admin' | 'nailmaster' | 'client';

// ============================================================
// users — базовая таблица всех пользователей
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().$type<UserRole>(),
  isGuest: boolean('is_guest').default(false).notNull(),
  blocked: boolean('blocked').default(false).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  age: integer('age'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// admin_profiles — профили администраторов
// ============================================================
export const adminProfiles = pgTable('admin_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  permissions: jsonb('permissions').$type<string[]>(),
  isActive: boolean('is_active').default(true).notNull(),
});

// ============================================================
// client_profiles — профили клиентов
// ============================================================
export const clientProfiles = pgTable('client_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
});

// ============================================================
// master_profiles — профили мастеров
// ============================================================
export const masterProfiles = pgTable('master_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  description: text('description'),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  experience: varchar('experience', { length: 100 }),
  city: varchar('city', { length: 100 }),
  rating: decimal('rating', { precision: 2, scale: 1 }).default('0').notNull(),
  totalOrders: integer('total_orders').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isModerated: boolean('is_moderated').default(false).notNull(),
  reviewsCount: integer('reviews_count').default(0).notNull(),
  specialties: jsonb('specialties').$type<string[]>(),
  startingPrice: decimal('starting_price', { precision: 10, scale: 2 }),
  workFormat: jsonb('work_format').$type<string[]>(),
  sterilization: boolean('sterilization').default(false).notNull(),
  disposableTools: boolean('disposable_tools').default(false).notNull(),
  sterilizationPhoto: varchar('sterilization_photo', { length: 500 }),
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),
});

// ============================================================
// Relations for user types
// ============================================================
export const usersRelations = relations(users, ({ one, many }) => ({
  adminProfile: one(adminProfiles, {
    fields: [users.id],
    references: [adminProfiles.userId],
  }),
  clientProfile: one(clientProfiles, {
    fields: [users.id],
    references: [clientProfiles.userId],
  }),
  masterProfile: one(masterProfiles, {
    fields: [users.id],
    references: [masterProfiles.userId],
  }),
  comments: many(import('./comments').then(m => m.comments) as never),
  notifications: many(import('./notifications').then(m => m.notifications) as never),
}));

export const adminProfilesRelations = relations(adminProfiles, ({ one }) => ({
  user: one(users, {
    fields: [adminProfiles.userId],
    references: [users.id],
  }),
}));

export const clientProfilesRelations = relations(clientProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [clientProfiles.userId],
    references: [users.id],
  }),
  uploadedDesigns: many(import('./designs').then(m => m.nailDesigns) as never),
  orders: many(import('./orders').then(m => m.orders) as never),
  reviews: many(import('./reviews').then(m => m.reviews) as never),
  ratings: many(import('./reviews').then(m => m.masterRatings) as never),
}));

export const masterProfilesRelations = relations(masterProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [masterProfiles.userId],
    references: [users.id],
  }),
  designs: many(import('./designs').then(m => m.masterDesigns) as never),
  orders: many(import('./orders').then(m => m.orders) as never),
  ratings: many(import('./reviews').then(m => m.masterRatings) as never),
  schedules: many(import('./schedules').then(m => m.schedules) as never),
  services: many(import('./services').then(m => m.masterServices) as never),
}));

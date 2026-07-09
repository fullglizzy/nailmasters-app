import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

// ============================================================
// sms_codes — коды подтверждения по SMS
// ============================================================
export const smsCodes = pgTable('sms_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

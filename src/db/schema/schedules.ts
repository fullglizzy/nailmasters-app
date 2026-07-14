import { pgTable, uuid, date, time, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { masterProfiles } from './users';

// ============================================================
// schedules — расписание мастеров
// ============================================================
export const schedules = pgTable('schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  workDate: date('work_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('available'), // available | booked | blocked
  notes: text('notes'),
  masterId: uuid('master_id').notNull().references(() => masterProfiles.userId, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  masterIdx: index('idx_schedules_master').on(table.masterId),
  dateIdx: index('idx_schedules_date').on(table.workDate),
  uniqueSlot: unique('idx_schedules_unique_slot').on(table.masterId, table.workDate, table.startTime, table.endTime),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  nailMaster: one(masterProfiles, {
    fields: [schedules.masterId],
    references: [masterProfiles.userId],
  }),
}));

-- Add unique constraint to prevent duplicate schedule slots
-- Each master can only have one slot with the same date + start time + end time

-- Step 1: Remove existing duplicate slots (keep the earliest created one per group)
DELETE FROM schedules
WHERE id NOT IN (
  SELECT MIN(id) FROM schedules GROUP BY master_id, work_date, start_time, end_time
);

-- Step 2: Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique_slot
  ON schedules (master_id, work_date, start_time, end_time);

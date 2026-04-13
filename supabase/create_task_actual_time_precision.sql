-- Run this in Supabase SQL Editor
-- Allows Task.actualTime to store fractional minutes instead of whole numbers only.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Task'
      AND column_name = 'actualTime'
      AND data_type <> 'double precision'
  ) THEN
    ALTER TABLE "Task"
    ALTER COLUMN "actualTime" TYPE double precision
    USING "actualTime"::double precision;
  END IF;
END $$;

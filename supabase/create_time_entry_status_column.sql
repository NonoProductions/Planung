-- Run this in Supabase SQL Editor
-- Adds a status column so a currently running timer can be persisted.

ALTER TABLE "TimeEntry"
ADD COLUMN IF NOT EXISTS "userId" text;

UPDATE "TimeEntry" te
SET "userId" = t."userId"
FROM "Task" t
WHERE te."taskId" = t."id"
  AND te."userId" IS NULL;

ALTER TABLE "TimeEntry"
ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'completed';

UPDATE "TimeEntry"
SET "status" = 'completed'
WHERE "status" IS NULL;

CREATE INDEX IF NOT EXISTS "TimeEntry_userId_status_idx"
  ON "TimeEntry" ("userId", "status");

CREATE INDEX IF NOT EXISTS "TimeEntry_userId_startTime_idx"
  ON "TimeEntry" ("userId", "startTime" DESC);

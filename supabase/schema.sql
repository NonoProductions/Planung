-- ============================================================
-- Planung – Full Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- Channel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Channel" (
  "id"      TEXT PRIMARY KEY,
  "name"    TEXT NOT NULL,
  "color"   TEXT NOT NULL DEFAULT '#6366F1',
  "userId"  TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Task
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Task" (
  "id"            TEXT PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "status"        TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN | IN_PROGRESS | COMPLETED | ARCHIVED
  "plannedTime"   INTEGER,                         -- minutes
  "actualTime"    INTEGER,                         -- minutes
  "scheduledDate" TIMESTAMPTZ,
  "scheduledStart" TIMESTAMPTZ,
  "scheduledEnd"  TIMESTAMPTZ,
  "dueDate"       TIMESTAMPTZ,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "channelId"     TEXT REFERENCES "Channel"("id") ON DELETE SET NULL,
  "parentId"      TEXT REFERENCES "Task"("id")    ON DELETE CASCADE,
  "isRecurring"   BOOLEAN NOT NULL DEFAULT FALSE,
  "isBacklog"     BOOLEAN NOT NULL DEFAULT FALSE,
  "backlogBucket" TEXT,
  "backlogFolder" TEXT,
  "completedAt"   TIMESTAMPTZ,
  "userId"        TEXT NOT NULL,
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Objective
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Objective" (
  "id"        TEXT PRIMARY KEY,
  "title"     TEXT NOT NULL,
  "weekStart" TIMESTAMPTZ NOT NULL,
  "progress"  INTEGER NOT NULL DEFAULT 0,   -- 0-100
  "userId"    TEXT NOT NULL
);

-- ------------------------------------------------------------
-- CalendarCategory
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CalendarCategory" (
  "id"     TEXT PRIMARY KEY,
  "name"   TEXT NOT NULL,
  "color"  TEXT NOT NULL DEFAULT '#4F46E5',
  "userId" TEXT NOT NULL
);

-- ------------------------------------------------------------
-- CalendarEvent
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id"                 TEXT PRIMARY KEY,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "startTime"          TIMESTAMPTZ NOT NULL,
  "endTime"            TIMESTAMPTZ NOT NULL,
  "color"              TEXT,
  "isRecurring"        BOOLEAN NOT NULL DEFAULT FALSE,
  "recurringRule"      JSONB,
  "calendarCategoryId" TEXT REFERENCES "CalendarCategory"("id") ON DELETE SET NULL,
  "userId"             TEXT NOT NULL,
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TimeEntry
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TimeEntry" (
  "id"        TEXT PRIMARY KEY,
  "taskId"    TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
  "startTime" TIMESTAMPTZ NOT NULL,
  "endTime"   TIMESTAMPTZ,
  "duration"  INTEGER   -- seconds
);

-- ------------------------------------------------------------
-- Reflection
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Reflection" (
  "id"      TEXT PRIMARY KEY,
  "date"    TIMESTAMPTZ NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "mood"    INTEGER,   -- e.g. 1-5
  "userId"  TEXT NOT NULL
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_task_userid          ON "Task"("userId");
CREATE INDEX IF NOT EXISTS idx_task_scheduleddate   ON "Task"("scheduledDate");
CREATE INDEX IF NOT EXISTS idx_task_isbacklog       ON "Task"("isBacklog");
CREATE INDEX IF NOT EXISTS idx_task_parentid        ON "Task"("parentId");
CREATE INDEX IF NOT EXISTS idx_objective_userid     ON "Objective"("userId");
CREATE INDEX IF NOT EXISTS idx_objective_weekstart  ON "Objective"("weekStart");
CREATE INDEX IF NOT EXISTS idx_event_userid         ON "CalendarEvent"("userId");
CREATE INDEX IF NOT EXISTS idx_event_starttime      ON "CalendarEvent"("startTime");
CREATE INDEX IF NOT EXISTS idx_timeentry_taskid     ON "TimeEntry"("taskId");
CREATE INDEX IF NOT EXISTS idx_timeentry_starttime  ON "TimeEntry"("startTime");
CREATE INDEX IF NOT EXISTS idx_reflection_userid    ON "Reflection"("userId");
CREATE INDEX IF NOT EXISTS idx_reflection_date      ON "Reflection"("date");
CREATE INDEX IF NOT EXISTS idx_channel_userid       ON "Channel"("userId");
CREATE INDEX IF NOT EXISTS idx_calcategory_userid   ON "CalendarCategory"("userId");

-- ============================================================
-- Row Level Security (RLS)
-- Service-role key bypasses RLS, so no policies are needed.
-- Direct anon-key access from the browser is blocked.
-- ============================================================
ALTER TABLE "Task"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Channel"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Objective"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reflection"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry"        ENABLE ROW LEVEL SECURITY;

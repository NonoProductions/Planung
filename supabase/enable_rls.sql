-- Run this in: Supabase Dashboard → SQL Editor
-- Enables Row Level Security on all tables and adds per-user policies.
--
-- The app uses the service_role key server-side (bypasses RLS), but these
-- policies act as defense-in-depth: even if the anon key leaks or a bug
-- exposes the client, users can only access their own rows.

-- ============================================================
-- 1. Enable RLS on every table
-- ============================================================
ALTER TABLE "Task"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Channel"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Objective"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reflection"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry"        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Drop existing policies (idempotent re-runs)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own tasks"              ON "Task";
DROP POLICY IF EXISTS "Users can insert own tasks"            ON "Task";
DROP POLICY IF EXISTS "Users can update own tasks"            ON "Task";
DROP POLICY IF EXISTS "Users can delete own tasks"            ON "Task";

DROP POLICY IF EXISTS "Users can view own channels"           ON "Channel";
DROP POLICY IF EXISTS "Users can insert own channels"         ON "Channel";
DROP POLICY IF EXISTS "Users can update own channels"         ON "Channel";
DROP POLICY IF EXISTS "Users can delete own channels"         ON "Channel";

DROP POLICY IF EXISTS "Users can view own objectives"         ON "Objective";
DROP POLICY IF EXISTS "Users can insert own objectives"       ON "Objective";
DROP POLICY IF EXISTS "Users can update own objectives"       ON "Objective";
DROP POLICY IF EXISTS "Users can delete own objectives"       ON "Objective";

DROP POLICY IF EXISTS "Users can view own events"             ON "CalendarEvent";
DROP POLICY IF EXISTS "Users can insert own events"           ON "CalendarEvent";
DROP POLICY IF EXISTS "Users can update own events"           ON "CalendarEvent";
DROP POLICY IF EXISTS "Users can delete own events"           ON "CalendarEvent";

DROP POLICY IF EXISTS "Users can view own calendar categories"  ON "CalendarCategory";
DROP POLICY IF EXISTS "Users can insert own calendar categories" ON "CalendarCategory";
DROP POLICY IF EXISTS "Users can update own calendar categories" ON "CalendarCategory";
DROP POLICY IF EXISTS "Users can delete own calendar categories" ON "CalendarCategory";

DROP POLICY IF EXISTS "Users can view own reflections"        ON "Reflection";
DROP POLICY IF EXISTS "Users can insert own reflections"      ON "Reflection";
DROP POLICY IF EXISTS "Users can update own reflections"      ON "Reflection";
DROP POLICY IF EXISTS "Users can delete own reflections"      ON "Reflection";

DROP POLICY IF EXISTS "Users can view own time entries"       ON "TimeEntry";
DROP POLICY IF EXISTS "Users can insert own time entries"     ON "TimeEntry";
DROP POLICY IF EXISTS "Users can update own time entries"     ON "TimeEntry";
DROP POLICY IF EXISTS "Users can delete own time entries"     ON "TimeEntry";

-- ============================================================
-- 3. Per-table policies: authenticated users see only their rows
-- ============================================================

-- Task
CREATE POLICY "Users can view own tasks"   ON "Task" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own tasks" ON "Task" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own tasks" ON "Task" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own tasks" ON "Task" FOR DELETE USING (auth.uid()::text = "userId");

-- Channel
CREATE POLICY "Users can view own channels"   ON "Channel" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own channels" ON "Channel" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own channels" ON "Channel" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own channels" ON "Channel" FOR DELETE USING (auth.uid()::text = "userId");

-- Objective
CREATE POLICY "Users can view own objectives"   ON "Objective" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own objectives" ON "Objective" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own objectives" ON "Objective" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own objectives" ON "Objective" FOR DELETE USING (auth.uid()::text = "userId");

-- CalendarEvent
CREATE POLICY "Users can view own events"   ON "CalendarEvent" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own events" ON "CalendarEvent" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own events" ON "CalendarEvent" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own events" ON "CalendarEvent" FOR DELETE USING (auth.uid()::text = "userId");

-- CalendarCategory
CREATE POLICY "Users can view own calendar categories"   ON "CalendarCategory" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own calendar categories" ON "CalendarCategory" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own calendar categories" ON "CalendarCategory" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own calendar categories" ON "CalendarCategory" FOR DELETE USING (auth.uid()::text = "userId");

-- Reflection
CREATE POLICY "Users can view own reflections"   ON "Reflection" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own reflections" ON "Reflection" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own reflections" ON "Reflection" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own reflections" ON "Reflection" FOR DELETE USING (auth.uid()::text = "userId");

-- TimeEntry
CREATE POLICY "Users can view own time entries"   ON "TimeEntry" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can insert own time entries" ON "TimeEntry" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own time entries" ON "TimeEntry" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own time entries" ON "TimeEntry" FOR DELETE USING (auth.uid()::text = "userId");

-- Run this in: Supabase Dashboard → SQL Editor
-- Enables Row Level Security on all tables and removes table privileges from
-- the anon/authenticated roles.
-- Since the app uses the service_role key server-side, no policies are needed —
-- the service role bypasses RLS automatically.
-- Direct access via the anon key (e.g. from the browser or curl) is blocked.

ALTER TABLE "User"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Channel"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Objective"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarCategory"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reflection"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RitualCompletion"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalDavSync"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalDavProcessedEvent" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "User", "_prisma_migrations", "Task", "Channel", "Objective",
  "CalendarEvent", "CalendarCategory", "Reflection", "TimeEntry",
  "RitualCompletion", "CalDavSync", "CalDavProcessedEvent"
FROM anon, authenticated;

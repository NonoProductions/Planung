-- Run this in: Supabase Dashboard → SQL Editor
-- Creates the RitualCompletion table so ritual status syncs across devices.

CREATE TABLE IF NOT EXISTS "RitualCompletion" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    text NOT NULL,
  "date"      text NOT NULL,
  "type"      text NOT NULL CHECK ("type" IN ('planning', 'shutdown')),
  "note"      text,
  "createdAt" timestamptz DEFAULT now()
);

-- Unique constraint: one completion per user + date + type
CREATE UNIQUE INDEX IF NOT EXISTS "RitualCompletion_user_date_type_idx"
  ON "RitualCompletion" ("userId", "date", "type");

-- RLS
ALTER TABLE "RitualCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RitualCompletion" FORCE ROW LEVEL SECURITY;

-- Service role full access (app backend)
DROP POLICY IF EXISTS "Service role full access ritual completion" ON "RitualCompletion";
CREATE POLICY "Service role full access ritual completion" ON "RitualCompletion"
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- User-scoped policies
DROP POLICY IF EXISTS "Users own ritual completion select" ON "RitualCompletion";
CREATE POLICY "Users own ritual completion select" ON "RitualCompletion"
  FOR SELECT USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "Users own ritual completion insert" ON "RitualCompletion";
CREATE POLICY "Users own ritual completion insert" ON "RitualCompletion"
  FOR INSERT WITH CHECK ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "Users own ritual completion delete" ON "RitualCompletion";
CREATE POLICY "Users own ritual completion delete" ON "RitualCompletion"
  FOR DELETE USING ("userId" = current_setting('request.jwt.claims', true)::json->>'sub');

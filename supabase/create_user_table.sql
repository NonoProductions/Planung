-- Run this in: Supabase Dashboard → SQL Editor
-- Creates the User table for credential-based authentication.

CREATE TABLE IF NOT EXISTS "User" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         text UNIQUE NOT NULL,
  "name"          text,
  "passwordHash"  text NOT NULL,
  "createdAt"     timestamptz DEFAULT now(),
  "updatedAt"     timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON "User";
DROP POLICY IF EXISTS "Users can update own profile" ON "User";

CREATE POLICY "Users can view own profile"   ON "User" FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON "User" FOR UPDATE USING (auth.uid()::text = id::text);

-- Index for login lookups
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" ("email");

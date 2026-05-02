-- CalDAV (Apple Calendar / FocusPomo) sync tables.
-- Run with: node supabase/setup_caldav_sync.mjs <db-password>

-- 1. CalDavSync: per-user CalDAV connection settings.
CREATE TABLE IF NOT EXISTS "CalDavSync" (
  "userId" text PRIMARY KEY,
  "appleEmail" text NOT NULL,
  "encryptedAppPassword" text NOT NULL,
  "encryptionIv" text NOT NULL,
  "encryptionTag" text NOT NULL,
  "serverUrl" text NOT NULL DEFAULT 'https://caldav.icloud.com',
  "calendarUrl" text,
  "calendarName" text,
  "lastSyncAt" timestamptz,
  "lastSyncStatus" text,
  "lastSyncMessage" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "lookbackDays" integer NOT NULL DEFAULT 14,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "CalDavSync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalDavSync" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access cal dav sync" ON "CalDavSync";
CREATE POLICY "Service role full access cal dav sync" ON "CalDavSync"
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- 2. CalDavProcessedEvent: dedup table — one row per imported event.
CREATE TABLE IF NOT EXISTS "CalDavProcessedEvent" (
  "userId" text NOT NULL,
  "eventUid" text NOT NULL,
  "calendarUrl" text NOT NULL,
  "eventSummary" text,
  "eventStart" timestamptz,
  "eventEnd" timestamptz,
  "durationMinutes" double precision NOT NULL,
  "matchedTaskId" text,
  "matchedTaskTitle" text,
  "appliedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "eventUid")
);

CREATE INDEX IF NOT EXISTS "CalDavProcessedEvent_userId_idx"
  ON "CalDavProcessedEvent" ("userId", "appliedAt" DESC);

ALTER TABLE "CalDavProcessedEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalDavProcessedEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access cal dav processed event" ON "CalDavProcessedEvent";
CREATE POLICY "Service role full access cal dav processed event" ON "CalDavProcessedEvent"
  FOR ALL USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

import "server-only";

import { supabase } from "@/lib/supabase";
import { decryptSecret } from "@/lib/credentials-crypto";
import { fetchEvents, type CalDavCredentials } from "@/lib/caldav-client";
import type { IcsEvent } from "@/lib/ics-parser";

export interface SyncResult {
  imported: number;
  skippedDuplicate: number;
  skippedNoMatch: number;
  totalFetched: number;
  appliedEvents: AppliedEvent[];
  unmatchedEvents: { uid: string; summary: string; durationMinutes: number; start: string }[];
  errors: string[];
}

export interface AppliedEvent {
  uid: string;
  summary: string;
  durationMinutes: number;
  start: string;
  taskId: string;
  taskTitle: string;
}

interface CalDavSyncRow {
  userId: string;
  appleEmail: string;
  encryptedAppPassword: string;
  encryptionIv: string;
  encryptionTag: string;
  serverUrl: string;
  calendarUrl: string | null;
  calendarName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  enabled: boolean;
  lookbackDays: number;
}

export async function loadSyncRow(userId: string): Promise<CalDavSyncRow | null> {
  const { data, error } = await supabase
    .from("CalDavSync")
    .select(
      'userId, appleEmail, encryptedAppPassword, encryptionIv, encryptionTag, serverUrl, calendarUrl, calendarName, lastSyncAt, lastSyncStatus, lastSyncMessage, enabled, lookbackDays'
    )
    .eq("userId", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as CalDavSyncRow | null) ?? null;
}

export function rowToCredentials(row: CalDavSyncRow): CalDavCredentials {
  return {
    serverUrl: row.serverUrl,
    email: row.appleEmail,
    appPassword: decryptSecret({
      ciphertext: row.encryptedAppPassword,
      iv: row.encryptionIv,
      tag: row.encryptionTag,
    }),
  };
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  actualTime: number | null;
  completedAt: string | null;
}

function pickBestMatch(event: IcsEvent, candidates: TaskRow[]): TaskRow | null {
  if (candidates.length === 0) return null;

  // Prefer (in this order):
  //   1. Same scheduledDate as the event — this dominates everything else,
  //      otherwise pomodoros from past days get hoovered up onto today's
  //      open task because old tasks are usually already COMPLETED.
  //   2. Open / in-progress over completed.
  //   3. Closest scheduledDate to event date.
  //   4. Longest title (more specific match).
  const eventDay = event.start.toISOString().slice(0, 10);

  const score = (task: TaskRow): number => {
    let s = 0;
    if (task.scheduledDate && task.scheduledDate.startsWith(eventDay)) s += 1000;
    if (task.status !== "COMPLETED" && task.status !== "ARCHIVED") s += 100;
    if (task.scheduledDate) {
      const diffDays = Math.abs(
        (new Date(task.scheduledDate).getTime() - event.start.getTime()) / (24 * 60 * 60 * 1000)
      );
      s += Math.max(0, 30 - diffDays);
    }
    s += Math.min(20, task.title.length / 4);
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

async function findMatchingTasks(userId: string, summary: string): Promise<TaskRow[]> {
  // Substring match, case-insensitive, in either direction:
  //   eventSummary "Mathe" -> matches task "Mathe 2"  (task contains event)
  //   eventSummary "Mathe Hausaufgaben" -> matches task "Mathe" (event contains task)
  // We do this in two queries with PostgREST `ilike`.
  const escaped = summary.replace(/[%_]/g, "\\$&").trim();
  if (!escaped) return [];

  // Tasks whose title contains the event summary.
  const { data: containsHit, error: e1 } = await supabase
    .from("Task")
    .select("id, title, status, scheduledDate, actualTime, completedAt")
    .eq("userId", userId)
    .ilike("title", `%${escaped}%`);

  if (e1) throw e1;

  const results: TaskRow[] = (containsHit ?? []) as TaskRow[];

  // Also pull all tasks (cap to a reasonable window) and check the reverse direction client-side,
  // since "task title is a substring of event summary" can't be done with `ilike` on the column.
  // Limit to ~500 tasks within the last 90 / next 30 days to keep this bounded.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: e2 } = await supabase
    .from("Task")
    .select("id, title, status, scheduledDate, actualTime, completedAt")
    .eq("userId", userId)
    .gte("scheduledDate", ninetyDaysAgo)
    .limit(500);

  if (e2) throw e2;

  const lowerSummary = summary.toLowerCase();
  const seen = new Set(results.map((t) => t.id));
  for (const t of (recent ?? []) as TaskRow[]) {
    if (seen.has(t.id)) continue;
    const title = t.title?.toLowerCase().trim();
    if (title && title.length >= 2 && lowerSummary.includes(title)) {
      results.push(t);
    }
  }

  return results;
}

interface ProcessedRow {
  eventUid: string;
}

export async function runSync(userId: string): Promise<SyncResult> {
  const row = await loadSyncRow(userId);
  if (!row) {
    throw new Error("Keine CalDAV-Verbindung konfiguriert.");
  }
  if (!row.enabled) {
    throw new Error("CalDAV-Sync ist deaktiviert.");
  }
  if (!row.calendarUrl) {
    throw new Error("Kein Kalender ausgewählt.");
  }

  const credentials = rowToCredentials(row);
  const lookbackDays = row.lookbackDays > 0 ? row.lookbackDays : 14;
  const rangeEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const rangeStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const result: SyncResult = {
    imported: 0,
    skippedDuplicate: 0,
    skippedNoMatch: 0,
    totalFetched: 0,
    appliedEvents: [],
    unmatchedEvents: [],
    errors: [],
  };

  let events: IcsEvent[];
  try {
    events = await fetchEvents(credentials, row.calendarUrl, rangeStart, rangeEnd);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter CalDAV-Fehler.";
    result.errors.push(message);
    await updateSyncStatus(userId, "error", message);
    throw new Error(message);
  }
  result.totalFetched = events.length;

  if (events.length === 0) {
    // Still recompute so historic double-counts get corrected even on no-op syncs.
    await recomputeActualTimeForUser(userId);
    await updateSyncStatus(userId, "ok", "Keine Events im Zeitraum gefunden.");
    return result;
  }

  // Load already-processed UIDs for this user.
  const { data: processedRows } = await supabase
    .from("CalDavProcessedEvent")
    .select("eventUid")
    .eq("userId", userId)
    .in(
      "eventUid",
      events.map((e) => e.uid)
    );
  const processedSet = new Set(((processedRows ?? []) as ProcessedRow[]).map((r) => r.eventUid));

  for (const event of events) {
    if (processedSet.has(event.uid)) {
      result.skippedDuplicate += 1;
      continue;
    }

    let matches: TaskRow[];
    try {
      matches = await findMatchingTasks(userId, event.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler bei der Task-Suche.";
      result.errors.push(`${event.summary}: ${message}`);
      continue;
    }

    const best = pickBestMatch(event, matches);
    if (!best) {
      result.skippedNoMatch += 1;
      result.unmatchedEvents.push({
        uid: event.uid,
        summary: event.summary,
        durationMinutes: event.durationMinutes,
        start: event.start.toISOString(),
      });
      continue;
    }

    // Insert the dedup row first. The (userId, eventUid) primary key prevents
    // double-counting if iCloud delivers the same event twice or the user
    // clicks sync repeatedly. We rely on this insert to gate the import —
    // actualTime itself is derived from these rows below, never incremented.
    const { error: insertErr } = await supabase.from("CalDavProcessedEvent").insert({
      userId,
      eventUid: event.uid,
      calendarUrl: row.calendarUrl,
      eventSummary: event.summary,
      eventStart: event.start.toISOString(),
      eventEnd: event.end.toISOString(),
      durationMinutes: event.durationMinutes,
      matchedTaskId: best.id,
      matchedTaskTitle: best.title,
    });

    if (insertErr) {
      result.errors.push(`${event.summary}: dedup insert failed (${insertErr.message})`);
      continue;
    }

    result.imported += 1;
    result.appliedEvents.push({
      uid: event.uid,
      summary: event.summary,
      durationMinutes: event.durationMinutes,
      start: event.start.toISOString(),
      taskId: best.id,
      taskTitle: best.title,
    });
  }

  // Recompute actualTime for every task that has CalDAV-imported events.
  // This is the single source of truth: actualTime = sum of all ProcessedEvent
  // durations matched to this task. Running it on every sync also corrects
  // historic double-counts from earlier non-idempotent sync versions.
  await recomputeActualTimeForUser(userId);

  const summary =
    `${result.imported} importiert, ${result.skippedDuplicate} bereits bekannt, ` +
    `${result.skippedNoMatch} ohne passende Task.`;
  await updateSyncStatus(userId, result.errors.length ? "partial" : "ok", summary);

  return result;
}

async function recomputeActualTimeForUser(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("CalDavProcessedEvent")
    .select("matchedTaskId, durationMinutes, eventStart, eventSummary")
    .eq("userId", userId)
    .not("matchedTaskId", "is", null);

  if (error) return;

  type ProcessedRow = {
    matchedTaskId: string | null;
    durationMinutes: number;
    eventStart: string | null;
    eventSummary: string | null;
  };

  // Same-session dedup. FocusPomo emits two VEVENTs per pomodoro (a "planned"
  // 25-min event at start and an "actual" event at stop, different UIDs but
  // same start + summary). fetchEvents collapses them within a single sync,
  // but if the user synced between start and stop, the old "planned" row is
  // already in CalDavProcessedEvent and a naive sum double-counts the session.
  // Round the start to the minute so the planned/actual pair collapses even
  // when their timestamps differ by a few seconds, and keep the longest
  // duration per (matchedTaskId, minute, summary).
  const bestByKey = new Map<string, ProcessedRow>();
  for (const row of (data ?? []) as ProcessedRow[]) {
    if (!row.matchedTaskId) continue;
    const startMs = row.eventStart ? Date.parse(row.eventStart) : NaN;
    const minuteBucket = Number.isFinite(startMs)
      ? Math.floor(startMs / 60_000)
      : (row.eventStart ?? "");
    const summaryKey = (row.eventSummary ?? "").trim().toLowerCase();
    const key = `${row.matchedTaskId}|${minuteBucket}|${summaryKey}`;
    const existing = bestByKey.get(key);
    if (!existing || (row.durationMinutes ?? 0) > (existing.durationMinutes ?? 0)) {
      bestByKey.set(key, row);
    }
  }

  const sumByTask = new Map<string, number>();
  for (const row of bestByKey.values()) {
    if (!row.matchedTaskId) continue;
    sumByTask.set(
      row.matchedTaskId,
      (sumByTask.get(row.matchedTaskId) ?? 0) + (row.durationMinutes ?? 0)
    );
  }

  if (sumByTask.size === 0) return;

  // Pull plannedTime + status for all affected tasks so we can auto-complete
  // those whose actualTime has reached or exceeded plannedTime.
  const { data: taskRows } = await supabase
    .from("Task")
    .select('id, status, plannedTime')
    .eq("userId", userId)
    .in("id", [...sumByTask.keys()]);

  const taskMeta = new Map<string, { status: string; plannedTime: number | null }>();
  for (const row of (taskRows ?? []) as { id: string; status: string; plannedTime: number | null }[]) {
    taskMeta.set(row.id, { status: row.status, plannedTime: row.plannedTime });
  }

  const now = new Date().toISOString();
  for (const [taskId, totalMinutes] of sumByTask) {
    const meta = taskMeta.get(taskId);
    const rounded = Math.round(totalMinutes);

    const update: { actualTime: number; updatedAt: string; status?: string; completedAt?: string } = {
      actualTime: rounded,
      updatedAt: now,
    };

    // Auto-complete: actualTime reached plannedTime AND task isn't already
    // completed/archived AND a plannedTime is actually set.
    if (
      meta &&
      meta.plannedTime &&
      meta.plannedTime > 0 &&
      rounded >= meta.plannedTime &&
      meta.status !== "COMPLETED" &&
      meta.status !== "ARCHIVED"
    ) {
      update.status = "COMPLETED";
      update.completedAt = now;
    }

    await supabase
      .from("Task")
      .update(update)
      .eq("id", taskId)
      .eq("userId", userId);
  }
}

async function updateSyncStatus(
  userId: string,
  status: "ok" | "error" | "partial",
  message: string
) {
  await supabase
    .from("CalDavSync")
    .update({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: status,
      lastSyncMessage: message.slice(0, 500),
      updatedAt: new Date().toISOString(),
    })
    .eq("userId", userId);
}

import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

interface ProcessedEventRow {
  eventUid: string;
  eventSummary: string | null;
  eventStart: string | null;
  durationMinutes: number | null;
  matchedTaskId: string | null;
  matchedTaskTitle: string | null;
  appliedAt: string | null;
}

/**
 * Read-only view of recently credited calendar events, so the settings page can
 * show "what got loaded today". Returns the most recent processed events plus
 * the newest event timestamp seen — a stale newest-event date is the tell-tale
 * sign that FocusPomo stopped writing to the calendar.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("CalDavProcessedEvent")
    .select(
      "eventUid, eventSummary, eventStart, durationMinutes, matchedTaskId, matchedTaskTitle, appliedAt"
    )
    .eq("userId", userId)
    .gte("eventStart", thirtyDaysAgo)
    .order("eventStart", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ProcessedEventRow[];

  // Newest event start across ALL processed events (not just the 30-day window),
  // so the staleness indicator stays accurate even after a long gap.
  const { data: newestRow } = await supabase
    .from("CalDavProcessedEvent")
    .select("eventStart")
    .eq("userId", userId)
    .not("eventStart", "is", null)
    .order("eventStart", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({
    events: rows.map((r) => ({
      uid: r.eventUid,
      summary: r.eventSummary ?? "",
      start: r.eventStart,
      durationMinutes: r.durationMinutes ?? 0,
      taskId: r.matchedTaskId,
      taskTitle: r.matchedTaskTitle ?? "",
      appliedAt: r.appliedAt,
    })),
    newestEventStart: (newestRow as { eventStart: string | null } | null)?.eventStart ?? null,
  });
}

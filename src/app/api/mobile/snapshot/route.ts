import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

const COMPLETED_WINDOW_DAYS = 90;

// GET /api/mobile/snapshot
// Everything the native apps need to work offline: all tasks (top-level and
// subtasks, flat with parentId; completed ones only from the last 90 days),
// raw calendar events (recurring ones unexpanded), channels, calendar
// categories and objectives.
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const completedSince = new Date(
    Date.now() - COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [tasks, events, channels, calendars, objectives] = await Promise.all([
    supabase
      .from("Task")
      .select("*")
      .eq("userId", userId)
      .or(`status.neq.COMPLETED,completedAt.gte.${completedSince}`)
      .order("position", { ascending: true }),
    supabase.from("CalendarEvent").select("*").eq("userId", userId),
    supabase.from("Channel").select("*").eq("userId", userId).order("name"),
    supabase.from("CalendarCategory").select("*").eq("userId", userId).order("name"),
    supabase.from("Objective").select("*").eq("userId", userId),
  ]);

  for (const result of [tasks, events, channels, calendars, objectives]) {
    if (result.error) throw result.error;
  }

  return Response.json({
    tasks: tasks.data,
    events: events.data,
    channels: channels.data,
    calendars: calendars.data,
    objectives: objectives.data,
    completedWindowDays: COMPLETED_WINDOW_DAYS,
  });
}

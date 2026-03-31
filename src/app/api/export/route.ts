import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

const EMPTY_EXPORT = {
  tasks: [],
  objectives: [],
  events: [],
  channels: [],
  calendarCategories: [],
};

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [tasksResult, objectivesResult, eventsResult, channelsResult, categoriesResult] =
      await Promise.all([
        supabase
          .from("Task")
          .select("*, channel:Channel(*)")
          .eq("userId", userId)
          .order("position", { ascending: true }),
        supabase
          .from("Objective")
          .select("*")
          .eq("userId", userId)
          .order("weekStart", { ascending: true }),
        supabase
          .from("CalendarEvent")
          .select("*")
          .eq("userId", userId)
          .order("startTime", { ascending: true }),
        supabase
          .from("Channel")
          .select("*")
          .eq("userId", userId)
          .order("name", { ascending: true }),
        supabase
          .from("CalendarCategory")
          .select("*")
          .eq("userId", userId)
          .order("name", { ascending: true }),
      ]);

    const firstError =
      tasksResult.error ??
      objectivesResult.error ??
      eventsResult.error ??
      channelsResult.error ??
      categoriesResult.error;

    if (firstError) throw firstError;

    return Response.json({
      tasks: tasksResult.data ?? [],
      objectives: objectivesResult.data ?? [],
      events: eventsResult.data ?? [],
      channels: channelsResult.data ?? [],
      calendarCategories: categoriesResult.data ?? [],
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse(EMPTY_EXPORT);
    }
    throw error;
  }
}

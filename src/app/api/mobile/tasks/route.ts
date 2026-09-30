import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

const COMPLETED_WINDOW_DAYS = 30;

// GET /api/mobile/tasks
// Full list of top-level tasks for the iOS sync app: all open tasks plus tasks
// completed in the last 30 days. A mapped task missing here was deleted.
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const completedSince = new Date(
    Date.now() - COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("Task")
    .select(
      "id, title, description, status, plannedTime, scheduledDate, scheduledStart, scheduledEnd, isBacklog, completedAt, updatedAt"
    )
    .eq("userId", userId)
    .is("parentId", null)
    .or(`status.neq.COMPLETED,completedAt.gte.${completedSince}`)
    .order("position", { ascending: true });

  if (error) throw error;

  return Response.json({ tasks: data, completedWindowDays: COMPLETED_WINDOW_DAYS });
}

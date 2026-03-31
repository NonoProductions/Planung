import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import { isDatabaseUnavailableError } from "@/lib/api-db-error";

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: tasks, error: taskReadError } = await supabase
      .from("Task")
      .select("id,parentId")
      .eq("userId", userId);

    if (taskReadError) throw taskReadError;

    const taskIds = (tasks ?? []).map((task) => task.id as string);

    if (taskIds.length > 0) {
      const { error: timeEntryDeleteError } = await supabase
        .from("TimeEntry")
        .delete()
        .in("taskId", taskIds);

      if (timeEntryDeleteError) throw timeEntryDeleteError;
    }

    const { error: subtaskDeleteError } = await supabase
      .from("Task")
      .delete()
      .eq("userId", userId)
      .not("parentId", "is", null);

    if (subtaskDeleteError) throw subtaskDeleteError;

    const { error: taskDeleteError } = await supabase
      .from("Task")
      .delete()
      .eq("userId", userId)
      .is("parentId", null);

    if (taskDeleteError) throw taskDeleteError;

    const [
      reflectionsResult,
      objectivesResult,
      eventsResult,
      channelsResult,
      categoriesResult,
    ] = await Promise.all([
      supabase.from("Reflection").delete().eq("userId", userId),
      supabase.from("Objective").delete().eq("userId", userId),
      supabase.from("CalendarEvent").delete().eq("userId", userId),
      supabase.from("Channel").delete().eq("userId", userId),
      supabase.from("CalendarCategory").delete().eq("userId", userId),
    ]);

    const firstError =
      reflectionsResult.error ??
      objectivesResult.error ??
      eventsResult.error ??
      channelsResult.error ??
      categoriesResult.error;

    if (firstError) throw firstError;

    return Response.json({ success: true });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return Response.json(
        { error: "Die Demo-Datenbank ist derzeit nicht erreichbar." },
        { status: 503 }
      );
    }

    throw error;
  }
}

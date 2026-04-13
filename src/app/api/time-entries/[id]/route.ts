import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import { isDatabaseUnavailableError } from "@/lib/api-db-error";

function isMissingTimeEntryTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: string; code?: string };
  return (
    value.code === "PGRST205" ||
    value.message?.includes("TimeEntry") === true ||
    value.message?.includes("relation") === true
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  if (body.action !== "stop") {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { data: entry, error: entryLookupError } = await supabase
    .from("TimeEntry")
    .select("id, taskId, startTime, duration, status")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (entryLookupError) {
    throw entryLookupError;
  }

  if (!entry) {
    return Response.json({ error: "Time entry not found" }, { status: 404 });
  }

  if (entry.status !== "running") {
    return Response.json({ error: "Time entry is not running" }, { status: 409 });
  }

  const endTime = new Date().toISOString();
  const durationSeconds = Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(entry.startTime as string).getTime()) / 1000)
  );
  const durationMinutes = durationSeconds / 60;

  const { data: task, error: taskLookupError } = await supabase
    .from("Task")
    .select("id, actualTime")
    .eq("id", entry.taskId)
    .eq("userId", userId)
    .maybeSingle();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const completedEntry = {
    endTime,
    duration: durationSeconds,
    status: "completed",
  };

  try {
    const [{ data, error }, { error: taskUpdateError }] = await Promise.all([
      supabase
        .from("TimeEntry")
        .update(completedEntry)
        .eq("id", id)
        .eq("userId", userId)
        .select("id, taskId, startTime, endTime, duration, status")
        .single(),
      supabase
        .from("Task")
        .update({
          actualTime: (task.actualTime ?? 0) + durationMinutes,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", entry.taskId)
        .eq("userId", userId),
    ]);

    if (error) {
      throw error;
    }

    if (taskUpdateError) {
      throw taskUpdateError;
    }

    return Response.json(data);
  } catch (error) {
    if (isMissingTimeEntryTableError(error) || isDatabaseUnavailableError(error)) {
      return Response.json(
        {
          id,
          taskId: entry.taskId as string,
          startTime: entry.startTime as string,
          endTime,
          duration: durationSeconds,
          status: "completed",
        },
        {
          status: 200,
          headers: {
            "x-db-unavailable": "true",
            "x-time-entry-persisted": "false",
          },
        }
      );
    }

    throw error;
  }
}

import { endOfDay, startOfWeek } from "date-fns";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

function isMissingTimeEntryTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { message?: string; code?: string };
  return (
    value.code === "PGRST205" ||
    value.message?.includes("TimeEntry") === true ||
    value.message?.includes("relation") === true
  );
}

function getRange(searchParams: URLSearchParams) {
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (start && end) {
    return { start, end };
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return {
    start: weekStart.toISOString(),
    end: endOfDay(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const range = getRange(request.nextUrl.searchParams);

  try {
    const { data, error } = await supabase
      .from("TimeEntry")
      .select("id, taskId, startTime, endTime, duration")
      .gte("startTime", range.start)
      .lte("startTime", range.end)
      .order("startTime", { ascending: false });

    if (error) {
      throw error;
    }

    return Response.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error) || isMissingTimeEntryTableError(error)) {
      return createDbUnavailableResponse([]);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const startTime = typeof body.startTime === "string" ? body.startTime : new Date().toISOString();
  const endTime = typeof body.endTime === "string" ? body.endTime : undefined;
  const durationSeconds = typeof body.duration === "number"
    ? body.duration
    : endTime
      ? Math.max(
          60,
          Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
        )
      : undefined;

  if (!body.taskId || !durationSeconds) {
    return Response.json(
      { error: "taskId and a completed duration are required" },
      { status: 400 }
    );
  }

  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  const { data: existingTask, error: taskLookupError } = await supabase
    .from("Task")
    .select("id, actualTime")
    .eq("id", body.taskId)
    .eq("userId", userId)
    .maybeSingle();

  if (taskLookupError) {
    throw taskLookupError;
  }

  if (!existingTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const { error: taskUpdateError } = await supabase
    .from("Task")
    .update({
      actualTime: (existingTask.actualTime ?? 0) + durationMinutes,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", body.taskId);

  if (taskUpdateError) {
    throw taskUpdateError;
  }

  const fallbackEntry = {
    id: crypto.randomUUID(),
    taskId: body.taskId as string,
    startTime,
    endTime: endTime ?? new Date(new Date(startTime).getTime() + durationSeconds * 1000).toISOString(),
    duration: durationSeconds,
  };

  try {
    const { data, error } = await supabase
      .from("TimeEntry")
      .insert(fallbackEntry)
      .select("id, taskId, startTime, endTime, duration")
      .single();

    if (error) {
      throw error;
    }

    return Response.json(data, { status: 201 });
  } catch (error) {
    if (isMissingTimeEntryTableError(error)) {
      return Response.json(fallbackEntry, {
        status: 201,
        headers: {
          "x-time-entry-persisted": "false",
        },
      });
    }

    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse(fallbackEntry);
    }

    throw error;
  }
}

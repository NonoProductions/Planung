import { endOfDay, endOfWeek, parseISO, startOfWeek } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import { buildAnalyticsSnapshot } from "@/lib/analytics";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";
import type { AnalyticsTaskOption, TimeEntry } from "@/types";

function mapTask(record: Record<string, unknown>): AnalyticsTaskOption {
  const channelRecord = record.channel as Record<string, unknown> | null;

  return {
    id: record.id as string,
    title: record.title as string,
    status: record.status as AnalyticsTaskOption["status"],
    plannedTime: (record.plannedTime as number | null) ?? undefined,
    actualTime: (record.actualTime as number | null) ?? undefined,
    scheduledDate: typeof record.scheduledDate === "string"
      ? record.scheduledDate.slice(0, 10)
      : undefined,
    completedAt: (record.completedAt as string | null) ?? undefined,
    channel: channelRecord
      ? {
          id: channelRecord.id as string,
          name: channelRecord.name as string,
          color: channelRecord.color as string,
        }
      : undefined,
  };
}

function mapTimeEntry(record: Record<string, unknown>): TimeEntry {
  return {
    id: record.id as string,
    taskId: record.taskId as string,
    startTime: record.startTime as string,
    endTime: (record.endTime as string | null) ?? undefined,
    duration: (record.duration as number | null) ?? undefined,
  };
}

function getRange(searchParams: URLSearchParams) {
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (start && end) {
    return {
      start,
      end,
    };
  }

  const now = new Date();
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10),
    end: endOfWeek(now, { weekStartsOn: 1 }).toISOString().slice(0, 10),
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = getRange(searchParams);

  try {
    const [{ data: taskData, error: taskError }, timeEntriesResult] = await Promise.all([
      getSupabaseClient()
        .from("Task")
        .select("id, title, status, plannedTime, actualTime, scheduledDate, completedAt, channel:Channel(id, name, color)")
        .eq("userId", userId)
        .is("parentId", null)
        .eq("isBacklog", false)
        .neq("status", "ARCHIVED"),
      getSupabaseClient()
        .from("TimeEntry")
        .select("id, taskId, startTime, endTime, duration")
        .gte("startTime", parseISO(range.start).toISOString())
        .lte("startTime", endOfDay(parseISO(range.end)).toISOString()),
    ]);

    if (taskError) {
      throw taskError;
    }

    const tasks = ((taskData ?? []) as Record<string, unknown>[]).map(mapTask);
    const timeEntries = timeEntriesResult.error
      ? []
      : ((timeEntriesResult.data ?? []) as Record<string, unknown>[]).map(mapTimeEntry);

    return Response.json(
      buildAnalyticsSnapshot({
        tasks,
        timeEntries,
        rangeStart: range.start,
        rangeEnd: range.end,
      })
    );
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse(
        buildAnalyticsSnapshot({
          tasks: [],
          timeEntries: [],
          rangeStart: range.start,
          rangeEnd: range.end,
        })
      );
    }

    throw error;
  }
}

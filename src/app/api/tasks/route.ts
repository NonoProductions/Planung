import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

// GET /api/tasks?date=2026-03-24 OR ?weekStart=2026-03-23 OR ?backlog=true
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date");
    const weekStart = searchParams.get("weekStart");
    const backlog = searchParams.get("backlog");

    let query = getSupabaseClient()
      .from("Task")
      .select("*, channel:Channel(*), subtasks:Task!parentId(*)")
      .eq("userId", userId)
      .is("parentId", null)
      .order("position", { ascending: true });

    if (backlog === "true") {
      query = query.eq("isBacklog", true);
    } else if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query = query
        .gte("scheduledDate", start.toISOString())
        .lte("scheduledDate", end.toISOString());
    } else if (weekStart) {
      const start = new Date(weekStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      query = query
        .gte("scheduledDate", start.toISOString())
        .lte("scheduledDate", end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse([]);
    }
    throw error;
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await getSupabaseClient()
    .from("Task")
    .insert({
      id: crypto.randomUUID(),
      title: body.title,
      description: body.description || null,
      status: "OPEN",
      plannedTime: body.plannedTime || null,
      scheduledDate: body.scheduledDate
        ? new Date(body.scheduledDate).toISOString()
        : null,
      position: body.position ?? 0,
      channelId: body.channelId || null,
      parentId: body.parentId || null,
      isRecurring: body.isRecurring ?? false,
      isBacklog: body.isBacklog ?? false,
      backlogBucket: body.backlogBucket || null,
      backlogFolder: body.backlogFolder || null,
      userId,
      updatedAt: new Date().toISOString(),
    })
    .select("*, channel:Channel(*)")
    .single();

  if (error) throw error;

  return Response.json({ ...data, subtasks: [] }, { status: 201 });
}

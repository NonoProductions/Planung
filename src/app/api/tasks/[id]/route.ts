import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// PATCH /api/tasks/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await getSupabaseClient()
    .from("Task")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) {
    data.status = body.status;
    data.completedAt =
      body.status === "COMPLETED" ? new Date().toISOString() : null;
  }
  if (body.plannedTime !== undefined) data.plannedTime = body.plannedTime;
  if (body.actualTime !== undefined) data.actualTime = body.actualTime;
  if (body.scheduledDate !== undefined)
    data.scheduledDate = body.scheduledDate
      ? new Date(body.scheduledDate).toISOString()
      : null;
  if (body.position !== undefined) data.position = body.position;
  if (body.channelId !== undefined) data.channelId = body.channelId || null;
  if (body.isBacklog !== undefined) data.isBacklog = body.isBacklog;
  if (body.backlogBucket !== undefined)
    data.backlogBucket = body.backlogBucket || null;
  if (body.backlogFolder !== undefined)
    data.backlogFolder = body.backlogFolder || null;
  if (body.scheduledStart !== undefined)
    data.scheduledStart = body.scheduledStart
      ? new Date(body.scheduledStart).toISOString()
      : null;
  if (body.scheduledEnd !== undefined)
    data.scheduledEnd = body.scheduledEnd
      ? new Date(body.scheduledEnd).toISOString()
      : null;

  const { data: task, error } = await getSupabaseClient()
    .from("Task")
    .update(data)
    .eq("id", id)
    .select("*, channel:Channel(*)")
    .single();

  if (error) throw error;

  return Response.json(task);
}

// DELETE /api/tasks/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await getSupabaseClient()
    .from("Task")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const { error } = await getSupabaseClient().from("Task").delete().eq("id", id);
  if (error) throw error;

  return Response.json({ success: true });
}

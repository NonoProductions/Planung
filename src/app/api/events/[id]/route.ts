import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// PATCH /api/events/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await getSupabaseClient()
    .from("CalendarEvent")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.startTime !== undefined)
    data.startTime = new Date(body.startTime).toISOString();
  if (body.endTime !== undefined)
    data.endTime = new Date(body.endTime).toISOString();
  if (body.color !== undefined) data.color = body.color;
  if (body.isRecurring !== undefined) data.isRecurring = body.isRecurring;
  if (body.recurringRule !== undefined) data.recurringRule = body.recurringRule;
  if (body.calendarCategoryId !== undefined)
    data.calendarCategoryId = body.calendarCategoryId;

  const { data: event, error } = await getSupabaseClient()
    .from("CalendarEvent")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return Response.json(event);
}

// DELETE /api/events/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await getSupabaseClient()
    .from("CalendarEvent")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  const { error } = await getSupabaseClient().from("CalendarEvent").delete().eq("id", id);
  if (error) throw error;

  return Response.json({ success: true });
}

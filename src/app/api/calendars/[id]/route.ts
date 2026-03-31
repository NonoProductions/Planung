import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// PATCH /api/calendars/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await supabase
    .from("CalendarCategory")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Calendar not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.color !== undefined) updateData.color = body.color;

  const { data, error } = await supabase
    .from("CalendarCategory")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return Response.json(data);
}

// DELETE /api/calendars/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("CalendarCategory")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Calendar not found" }, { status: 404 });
  }

  // Unlink events from this category before deleting
  await supabase
    .from("CalendarEvent")
    .update({ calendarCategoryId: null, updatedAt: new Date().toISOString() })
    .eq("calendarCategoryId", id);

  const { error } = await supabase
    .from("CalendarCategory")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return Response.json({ success: true });
}

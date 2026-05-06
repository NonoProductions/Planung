import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// PATCH /api/channels/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await supabase
    .from("Channel")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Channel not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updateData.name = body.name.trim();
  }
  if (typeof body.color === "string" && body.color) {
    updateData.color = body.color;
  }

  const { data, error } = await supabase
    .from("Channel")
    .update(updateData)
    .eq("id", id)
    .eq("userId", userId)
    .select()
    .single();

  if (error) throw error;
  return Response.json(data);
}

// DELETE /api/channels/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("Channel")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Channel not found" }, { status: 404 });
  }

  // Unlink tasks from this channel before deleting
  await supabase
    .from("Task")
    .update({ channelId: null, updatedAt: new Date().toISOString() })
    .eq("channelId", id)
    .eq("userId", userId);

  const { error } = await supabase
    .from("Channel")
    .delete()
    .eq("id", id)
    .eq("userId", userId);

  if (error) throw error;
  return Response.json({ success: true });
}

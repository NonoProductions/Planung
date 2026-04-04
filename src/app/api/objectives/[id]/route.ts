import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// PATCH /api/objectives/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await supabase
    .from("Objective")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Objective not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.progress !== undefined) updateData.progress = body.progress;

  const { data, error } = await supabase
    .from("Objective")
    .update(updateData)
    .eq("id", id)
    .eq("userId", userId)
    .select()
    .single();

  if (error) throw error;
  return Response.json(data);
}

// DELETE /api/objectives/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("Objective")
    .select("id")
    .eq("id", id)
    .eq("userId", userId)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Objective not found" }, { status: 404 });
  }

  const { error } = await supabase.from("Objective").delete().eq("id", id).eq("userId", userId);
  if (error) throw error;
  return Response.json({ success: true });
}

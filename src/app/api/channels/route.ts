import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

// GET /api/channels
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("Channel")
      .select("*")
      .eq("userId", userId)
      .order("name", { ascending: true });

    if (error) throw error;

    return Response.json(data);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse([]);
    }
    throw error;
  }
}

// POST /api/channels
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("Channel")
    .insert({
      id: crypto.randomUUID(),
      name,
      color: body.color || "#4F46E5",
      userId,
    })
    .select()
    .single();

  if (error) throw error;
  return Response.json(data, { status: 201 });
}

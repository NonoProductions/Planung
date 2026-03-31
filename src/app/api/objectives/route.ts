import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// GET /api/objectives?weekStart=2026-03-23
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const weekStart = searchParams.get("weekStart");

  let query = getSupabaseClient()
    .from("Objective")
    .select("*")
    .eq("userId", userId)
    .order("id", { ascending: true });

  if (weekStart) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekStart);
    end.setHours(23, 59, 59, 999);
    query = query
      .gte("weekStart", start.toISOString())
      .lte("weekStart", end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return Response.json(data);
}

// POST /api/objectives
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!body.title || !body.weekStart) {
    return Response.json(
      { error: "title and weekStart are required" },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabaseClient()
    .from("Objective")
    .insert({
      id: crypto.randomUUID(),
      title: body.title,
      weekStart: new Date(body.weekStart).toISOString(),
      progress: body.progress ?? 0,
      userId,
    })
    .select()
    .single();

  if (error) throw error;
  return Response.json(data, { status: 201 });
}

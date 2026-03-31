import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";

// GET /api/calendars
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("CalendarCategory")
    .select("*")
    .eq("userId", userId)
    .order("name", { ascending: true });

  if (error) throw error;
  return Response.json(data);
}

// POST /api/calendars
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("CalendarCategory")
    .insert({
      id: crypto.randomUUID(),
      name: body.name,
      color: body.color || "#4F46E5",
      userId,
    })
    .select()
    .single();

  if (error) throw error;
  return Response.json(data, { status: 201 });
}

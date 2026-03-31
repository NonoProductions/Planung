import { NextRequest } from "next/server";
import { createDbUnavailableResponse } from "@/lib/api-db-error";
import { requireUserId } from "@/lib/server-auth";
import { getSupabaseClient } from "@/lib/supabase";

function buildDayRange(date: string) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) return Response.json(null);

    const { start, end } = buildDayRange(date);

    const { data, error } = await getSupabaseClient()
      .from("Reflection")
      .select("*")
      .eq("userId", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return Response.json(data ?? null);
  } catch {
    return createDbUnavailableResponse(null);
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { date?: string; content?: string; mood?: number } = {};

  try {
    body = (await request.json()) as {
      date?: string;
      content?: string;
      mood?: number;
    };

    if (!body.date) {
      return Response.json({ error: "date is required" }, { status: 400 });
    }

    const { start, end } = buildDayRange(body.date);

    const { data: existing, error: lookupError } = await getSupabaseClient()
      .from("Reflection")
      .select("id")
      .eq("userId", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing) {
      const { data, error } = await getSupabaseClient()
        .from("Reflection")
        .update({
          content: body.content ?? "",
          mood: body.mood ?? null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return Response.json(data);
    }

    const { data, error } = await getSupabaseClient()
      .from("Reflection")
      .insert({
        id: crypto.randomUUID(),
        date: new Date(body.date).toISOString(),
        content: body.content ?? "",
        mood: body.mood ?? null,
        userId,
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch {
    return createDbUnavailableResponse({
      id: `local-reflection-${body.date ?? "unknown"}`,
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      content: body.content ?? "",
      mood: body.mood ?? null,
    });
  }
}

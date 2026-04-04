import { NextRequest } from "next/server";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";
import { requireUserId } from "@/lib/server-auth";
import { supabase } from "@/lib/supabase";

// GET /api/rituals?days=45
// Returns all ritual completions for the user (last N days by default).
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const days = Number(request.nextUrl.searchParams.get("days") ?? "45");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

    const { data, error } = await supabase
      .from("RitualCompletion")
      .select("date, type, note")
      .eq("userId", userId)
      .gte("date", cutoffDate)
      .order("date", { ascending: false });

    if (error) throw error;

    const planning: string[] = [];
    const shutdown: string[] = [];
    const notes: Record<string, string> = {};

    for (const row of data ?? []) {
      if (row.type === "planning") planning.push(row.date);
      if (row.type === "shutdown") shutdown.push(row.date);
      if (row.type === "shutdown" && row.note) notes[row.date] = row.note;
    }

    return Response.json({ planning, shutdown, notes });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse({ planning: [], shutdown: [], notes: {} });
    }
    throw error;
  }
}

// POST /api/rituals  { date, type, note? }
// Upserts a ritual completion for the given date + type.
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      date?: string;
      type?: string;
      note?: string;
    };

    if (!body.date || !body.type) {
      return Response.json(
        { error: "date and type are required" },
        { status: 400 }
      );
    }

    if (body.type !== "planning" && body.type !== "shutdown") {
      return Response.json(
        { error: "type must be 'planning' or 'shutdown'" },
        { status: 400 }
      );
    }

    // Upsert: insert or update on conflict
    const { data, error } = await supabase
      .from("RitualCompletion")
      .upsert(
        {
          userId,
          date: body.date,
          type: body.type,
          note: body.note ?? null,
        },
        { onConflict: "userId,date,type" }
      )
      .select()
      .single();

    if (error) throw error;

    return Response.json(data, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse({ ok: true });
    }
    throw error;
  }
}

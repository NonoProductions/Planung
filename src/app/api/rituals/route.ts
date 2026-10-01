import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { supabase } from "@/lib/supabase";

const UNIQUE_VIOLATION = "23505";

/**
 * Claims a once-per-day ritual moment (e.g. the automatic Feierabend prompt)
 * for the whole account. The unique (userId, date, type) index makes the claim
 * atomic, so only the first device that asks gets `claimed: true`.
 */
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { date?: string; type?: string } = {};
  try {
    body = (await request.json()) as { date?: string; type?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.date || !body.type) {
    return Response.json({ error: "date and type are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("RitualCompletion")
    .insert({ userId, date: body.date, type: body.type });

  if (!error) return Response.json({ claimed: true });
  if (error.code === UNIQUE_VIOLATION) return Response.json({ claimed: false });

  return Response.json({ error: "Database unavailable" }, { status: 503 });
}

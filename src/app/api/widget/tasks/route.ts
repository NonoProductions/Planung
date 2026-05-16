import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

// Read-only endpoint for the Scriptable widget.
// Auth: shared secret in `WIDGET_TOKEN` (Bearer header or ?token=…),
// user resolved via `WIDGET_USER_ID`. Returns today's tasks unless
// a ?date=YYYY-MM-DD override is supplied.
export async function GET(request: NextRequest) {
  const expectedToken = process.env.WIDGET_TOKEN;
  const userId = process.env.WIDGET_USER_ID;

  if (!expectedToken || !userId) {
    return Response.json(
      { error: "Widget not configured: set WIDGET_TOKEN and WIDGET_USER_ID" },
      { status: 503 }
    );
  }

  const presented =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.nextUrl.searchParams.get("token") ||
    "";

  if (!safeEqual(presented, expectedToken)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const target = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(target.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  try {
    const { data, error } = await supabase
      .from("Task")
      .select("id, title, status, plannedTime, actualTime, scheduledDate, scheduledStart, scheduledEnd, position, channel:Channel(id, name, color)")
      .eq("userId", userId)
      .is("parentId", null)
      .gte("scheduledDate", start.toISOString())
      .lte("scheduledDate", end.toISOString())
      .order("position", { ascending: true });

    if (error) throw error;

    return Response.json(data ?? [], {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse([]);
    }
    throw error;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

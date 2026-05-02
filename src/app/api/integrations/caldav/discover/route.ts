import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import { discoverCalendars } from "@/lib/caldav-client";
import { loadSyncRow, rowToCredentials } from "@/lib/caldav-sync";

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const debug = request.nextUrl.searchParams.get("debug") === "1";

  const row = await loadSyncRow(userId);
  if (!row) {
    return Response.json(
      { error: "Keine CalDAV-Verbindung konfiguriert." },
      { status: 400 }
    );
  }

  let credentials;
  try {
    credentials = rowToCredentials(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Entschlüsselung fehlgeschlagen.";
    return Response.json({ error: message }, { status: 500 });
  }

  let result;
  try {
    result = await discoverCalendars(credentials, { debug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CalDAV-Discovery fehlgeschlagen.";
    return Response.json({ error: message }, { status: 400 });
  }

  // Touch updatedAt so the UI can react.
  await supabase
    .from("CalDavSync")
    .update({ updatedAt: new Date().toISOString() })
    .eq("userId", userId);

  return Response.json({ calendars: result.calendars, debug: result.debug });
}

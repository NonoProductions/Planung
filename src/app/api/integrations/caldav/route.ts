import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import { encryptSecret } from "@/lib/credentials-crypto";
import { discoverCalendars } from "@/lib/caldav-client";

const DEFAULT_SERVER = "https://caldav.icloud.com";

interface SyncRow {
  appleEmail: string;
  serverUrl: string;
  calendarUrl: string | null;
  calendarName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  enabled: boolean;
  lookbackDays: number;
}

function publicView(row: SyncRow | null) {
  if (!row) {
    return {
      configured: false,
      enabled: false,
      appleEmail: null,
      serverUrl: DEFAULT_SERVER,
      calendarUrl: null,
      calendarName: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
      lookbackDays: 14,
    };
  }
  return {
    configured: true,
    enabled: row.enabled,
    appleEmail: row.appleEmail,
    serverUrl: row.serverUrl,
    calendarUrl: row.calendarUrl,
    calendarName: row.calendarName,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncMessage: row.lastSyncMessage,
    lookbackDays: row.lookbackDays,
  };
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("CalDavSync")
    .select(
      "appleEmail, serverUrl, calendarUrl, calendarName, lastSyncAt, lastSyncStatus, lastSyncMessage, enabled, lookbackDays"
    )
    .eq("userId", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(publicView((data as SyncRow | null) ?? null));
}

/**
 * POST: create or update the connection.
 * Body shapes:
 *   { appleEmail, appPassword, serverUrl? }
 *     -> validates credentials by discovering calendars; saves password.
 *   { calendarUrl, calendarName }
 *     -> selects an already-discovered calendar.
 *   { enabled?, lookbackDays? }
 *     -> updates settings.
 */
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;

  if (typeof body.appleEmail === "string" && typeof body.appPassword === "string") {
    const appleEmail = body.appleEmail.trim();
    const appPassword = (body.appPassword as string).replace(/\s/g, "");
    const serverUrl =
      typeof body.serverUrl === "string" && body.serverUrl.trim()
        ? body.serverUrl.trim()
        : DEFAULT_SERVER;

    if (!appleEmail || !appPassword) {
      return Response.json(
        { error: "Apple-ID und App-Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    let calendars;
    try {
      const result = await discoverCalendars({ serverUrl, email: appleEmail, appPassword });
      calendars = result.calendars;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verbindung fehlgeschlagen.";
      return Response.json({ error: message }, { status: 400 });
    }

    let encrypted;
    try {
      encrypted = encryptSecret(appPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verschlüsselung fehlgeschlagen.";
      return Response.json({ error: message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { error: upsertErr } = await supabase
      .from("CalDavSync")
      .upsert(
        {
          userId,
          appleEmail,
          encryptedAppPassword: encrypted.ciphertext,
          encryptionIv: encrypted.iv,
          encryptionTag: encrypted.tag,
          serverUrl,
          enabled: true,
          updatedAt: now,
        },
        { onConflict: "userId" }
      );

    if (upsertErr) {
      return Response.json({ error: upsertErr.message }, { status: 500 });
    }

    return Response.json({ ok: true, calendars });
  }

  if (typeof body.calendarUrl === "string") {
    const calendarUrl = body.calendarUrl.trim();
    const calendarName =
      typeof body.calendarName === "string" ? body.calendarName.trim() : "";
    if (!calendarUrl) {
      return Response.json({ error: "calendarUrl ist erforderlich." }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("CalDavSync")
      .update({
        calendarUrl,
        calendarName: calendarName || null,
        updatedAt: new Date().toISOString(),
      })
      .eq("userId", userId);

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (typeof body.enabled === "boolean" || typeof body.lookbackDays === "number") {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body.lookbackDays === "number") {
      updates.lookbackDays = Math.max(1, Math.min(60, Math.round(body.lookbackDays)));
    }

    const { error: updateErr } = await supabase
      .from("CalDavSync")
      .update(updates)
      .eq("userId", userId);

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unbekannter Request." }, { status: 400 });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("CalDavSync").delete().eq("userId", userId);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

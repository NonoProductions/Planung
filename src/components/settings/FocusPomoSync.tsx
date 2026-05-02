"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarSync,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LinkIcon,
  LoaderCircle,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";

interface ConnectionState {
  configured: boolean;
  enabled: boolean;
  appleEmail: string | null;
  serverUrl: string;
  calendarUrl: string | null;
  calendarName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lookbackDays: number;
}

interface DiscoveredCalendar {
  url: string;
  name: string;
  color?: string;
}

interface DiscoveryDebugPayload {
  startUrl: string;
  principalUrl?: string;
  homeHrefs: string[];
  step1?: { status: number; text: string };
  step2?: { status: number; text: string };
  step3?: { url: string; status: number; text: string }[];
  rawCandidates: {
    href: string;
    resourceType: string;
    displayName: string;
    compSet: string;
    skippedReason?: string;
  }[];
}

interface SyncResultPayload {
  imported: number;
  skippedDuplicate: number;
  skippedNoMatch: number;
  totalFetched: number;
  appliedEvents: {
    uid: string;
    summary: string;
    durationMinutes: number;
    start: string;
    taskId: string;
    taskTitle: string;
  }[];
  unmatchedEvents: {
    uid: string;
    summary: string;
    durationMinutes: number;
    start: string;
  }[];
  errors: string[];
}

const cardSubtleStyle = {
  borderColor: "#e4ddd6",
  backgroundColor: "#fffdfa",
} as const;

function formatLastSync(iso: string | null) {
  if (!iso) return "Noch nie";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMinutes(min: number) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function FocusPomoSync() {
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  const [state, setState] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [appleEmail, setAppleEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [discoveredCalendars, setDiscoveredCalendars] = useState<DiscoveredCalendar[] | null>(
    null
  );
  const [discovering, setDiscovering] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DiscoveryDebugPayload | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResultPayload | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected = state?.configured === true;
  const hasCalendarSelected = isConnected && Boolean(state?.calendarUrl);

  const statusBadge = useMemo(() => {
    if (!state) return null;
    if (!state.configured)
      return { label: "Nicht verbunden", color: "var(--text-muted)" };
    if (!state.calendarUrl)
      return { label: "Kalender wählen", color: "var(--accent-warning)" };
    if (state.lastSyncStatus === "error")
      return { label: "Fehler beim letzten Sync", color: "var(--accent-danger)" };
    if (state.lastSyncStatus === "partial")
      return { label: "Teilweise synchronisiert", color: "var(--accent-warning)" };
    return { label: "Bereit", color: "var(--accent-success)" };
  }, [state]);

  useEffect(() => {
    void loadState();
  }, []);

  // Auto-trigger discovery when connected but no calendar selected yet,
  // so the user doesn't have to click "Kalender neu laden" after a reload.
  useEffect(() => {
    if (
      state?.configured &&
      !state.calendarUrl &&
      discoveredCalendars === null &&
      !discovering
    ) {
      void handleDiscover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.configured, state?.calendarUrl]);

  async function loadState() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/caldav");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Status ${res.status}`);
      }
      const data = (await res.json()) as ConnectionState;
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setConnecting(true);

    try {
      const res = await fetch("/api/integrations/caldav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appleEmail, appPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verbindung fehlgeschlagen.");

      setDiscoveredCalendars((data.calendars ?? []) as DiscoveredCalendar[]);
      setAppPassword("");
      setInfo("Verbunden. Bitte den Kalender wählen, der die FocusPomo-Blöcke enthält.");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDiscover(opts: { debug?: boolean } = {}) {
    setError(null);
    setInfo(null);
    setDiscovering(true);
    if (opts.debug) setDebugInfo(null);

    try {
      const url = opts.debug
        ? "/api/integrations/caldav/discover?debug=1"
        : "/api/integrations/caldav/discover";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery fehlgeschlagen.");
      setDiscoveredCalendars((data.calendars ?? []) as DiscoveredCalendar[]);
      if (opts.debug && data.debug) {
        setDebugInfo(data.debug as DiscoveryDebugPayload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery fehlgeschlagen.");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSelectCalendar(cal: DiscoveredCalendar) {
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/integrations/caldav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarUrl: cal.url, calendarName: cal.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setDiscoveredCalendars(null);
      await loadState();
      setInfo(`Kalender "${cal.name}" ausgewählt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function handleSync() {
    setError(null);
    setInfo(null);
    setSyncing(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/integrations/caldav/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync fehlgeschlagen.");

      const result = data.result as SyncResultPayload;
      setLastResult(result);
      setInfo(
        `Sync abgeschlossen — ${result.imported} importiert, ${result.skippedDuplicate} bereits bekannt, ${result.skippedNoMatch} ohne passende Task.`
      );
      await loadState();
      void fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync fehlgeschlagen.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    setError(null);
    try {
      const res = await fetch("/api/integrations/caldav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function handleLookbackChange(days: number) {
    setError(null);
    try {
      const res = await fetch("/api/integrations/caldav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbackDays: days }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function handleDisconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/integrations/caldav", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Trennen fehlgeschlagen.");
      }
      setDiscoveredCalendars(null);
      setLastResult(null);
      setConfirmDisconnect(false);
      setInfo("Verbindung getrennt.");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trennen fehlgeschlagen.");
    }
  }

  if (loading) {
    return (
      <div
        className="workspace-surface flex items-center gap-3 p-5"
        style={cardSubtleStyle}
      >
        <LoaderCircle size={16} className="animate-spin" />
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          FocusPomo-Status wird geladen…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border p-4"
        style={cardSubtleStyle}
      >
        <div className="space-y-1">
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            FocusPomo → Apple Kalender → Tasks
          </p>
          <p className="text-[12.5px] leading-6" style={{ color: "var(--text-muted)" }}>
            Synchronisiert abgeschlossene Pomodoro-Blöcke aus deinem Apple Kalender und
            verbucht ihre Dauer auf Tasks, deren Titel den Event-Namen enthält
            (z. B. Event &quot;Mathe&quot; → Task &quot;Mathe 2&quot;).
          </p>
        </div>
        {statusBadge && (
          <span
            className="workspace-badge"
            style={{ color: statusBadge.color, borderColor: statusBadge.color }}
          >
            {statusBadge.label}
          </span>
        )}
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-[16px] border p-3 text-[12.5px] leading-6"
          style={{
            borderColor: "rgba(224, 111, 111, 0.28)",
            backgroundColor: "rgba(255, 240, 240, 0.98)",
            color: "#b45454",
          }}
        >
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {info && !error && (
        <div
          className="flex items-start gap-2 rounded-[16px] border p-3 text-[12.5px] leading-6"
          style={{
            borderColor: "rgba(106, 180, 130, 0.32)",
            backgroundColor: "rgba(239, 248, 242, 0.96)",
            color: "#3f7d56",
          }}
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {!isConnected && (
        <form
          onSubmit={handleConnect}
          className="space-y-4 rounded-[18px] border p-5"
          style={cardSubtleStyle}
        >
          <div className="space-y-1">
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Mit iCloud verbinden
            </p>
            <p className="text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
              Erstelle ein App-spezifisches Passwort unter{" "}
              <a
                href="https://appleid.apple.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent-primary)" }}
              >
                appleid.apple.com
              </a>{" "}
              (kostenlos, kein Developer-Account nötig) und trage es hier ein.
            </p>
          </div>

          <label className="block space-y-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              Apple-ID
            </span>
            <input
              type="email"
              value={appleEmail}
              onChange={(e) => setAppleEmail(e.target.value)}
              placeholder="dein.name@icloud.com"
              required
              className="workspace-input w-full"
            />
          </label>

          <label className="block space-y-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              App-spezifisches Passwort
            </span>
            <div className="flex items-center gap-3">
              <KeyRound size={14} style={{ color: "var(--text-muted)" }} />
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                required
                className="workspace-input min-w-0 flex-1"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={connecting || !appleEmail || !appPassword}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--accent-primary)", color: "white" }}
          >
            {connecting ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <LinkIcon size={14} strokeWidth={1.8} />
            )}
            {connecting ? "Verbinde…" : "Verbindung prüfen"}
          </button>
        </form>
      )}

      {isConnected && (
        <div className="rounded-[18px] border p-5 space-y-4" style={cardSubtleStyle}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p
                className="text-[13px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Verbunden als
              </p>
              <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                {state?.appleEmail}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
              style={{
                backgroundColor: confirmDisconnect ? "var(--accent-danger)" : "rgba(255, 241, 241, 0.96)",
                color: confirmDisconnect ? "white" : "var(--accent-danger)",
              }}
            >
              <Trash2 size={13} />
              {confirmDisconnect ? "Wirklich trennen" : "Verbindung trennen"}
            </button>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Kalender
              </span>
              <span
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {state?.calendarName ?? "— nicht gewählt —"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Letzter Sync
              </span>
              <span
                className="text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatLastSync(state?.lastSyncAt ?? null)}
              </span>
            </div>
            {state?.lastSyncMessage && (
              <p
                className="text-[12px] leading-6"
                style={{ color: "var(--text-muted)" }}
              >
                {state.lastSyncMessage}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleDiscover()}
              disabled={discovering}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
              style={{
                borderColor: "rgba(226, 218, 209, 0.95)",
                color: "var(--text-secondary)",
              }}
            >
              {discovering ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Kalender neu laden
            </button>

            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing || !hasCalendarSelected || state?.enabled === false}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--accent-primary)", color: "white" }}
            >
              {syncing ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <CalendarSync size={13} />
              )}
              {syncing ? "Synchronisiert…" : "Jetzt synchronisieren"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow
              label="Sync aktiv"
              description="Wenn aus, werden weder manuelle Syncs noch Auto-Syncs ausgeführt."
              checked={state?.enabled ?? true}
              onToggle={() => void handleToggleEnabled(!(state?.enabled ?? true))}
            />
            <label className="block space-y-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                Rückblick (Tage)
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={state?.lookbackDays ?? 14}
                onChange={(e) =>
                  void handleLookbackChange(Number(e.target.value) || 14)
                }
                className="workspace-input w-full"
              />
              <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                Wie weit zurück soll bei jedem Sync nach Events gesucht werden.
              </span>
            </label>
          </div>
        </div>
      )}

      {discoveredCalendars && discoveredCalendars.length > 0 && (
        <div className="rounded-[18px] border p-5 space-y-3" style={cardSubtleStyle}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Wähle den FocusPomo-Kalender
          </p>
          <p className="text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
            Das ist normalerweise der Kalender, den FocusPomo selbst angelegt hat (oft
            &quot;FocusPomo&quot; oder dein iCloud-Hauptkalender, falls du dort die Blöcke
            speicherst).
          </p>
          <div className="grid gap-2">
            {discoveredCalendars.map((cal) => (
              <button
                key={cal.url}
                type="button"
                onClick={() => void handleSelectCalendar(cal)}
                className="flex items-center justify-between gap-3 rounded-[14px] border p-3 text-left transition-transform duration-150 hover:-translate-y-[1px]"
                style={{
                  borderColor: "rgba(226, 218, 209, 0.95)",
                  backgroundColor:
                    state?.calendarUrl === cal.url
                      ? "rgba(240, 235, 255, 0.95)"
                      : "transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cal.color ?? "#b8b3ad" }}
                  />
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {cal.name}
                  </span>
                </div>
                {state?.calendarUrl === cal.url && (
                  <CheckCircle2 size={14} style={{ color: "var(--accent-primary)" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {discoveredCalendars && discoveredCalendars.length === 0 && (
        <div
          className="rounded-[16px] border p-3 text-[12.5px] leading-6 space-y-2"
          style={{
            borderColor: "rgba(244, 173, 70, 0.3)",
            backgroundColor: "rgba(255, 245, 230, 0.98)",
            color: "#9f6f24",
          }}
        >
          <div>
            <TriangleAlert size={14} className="mr-2 inline-block" />
            Keine Kalender gefunden. Wahrscheinlich findet meine Discovery-Logik die
            iCloud-Antwort nicht. Klick auf &quot;Debug-Info zeigen&quot;, dann sehe ich,
            was iCloud zurückschickt.
          </div>
          <button
            type="button"
            onClick={() => void handleDiscover({ debug: true })}
            disabled={discovering}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-60"
            style={{ borderColor: "currentColor" }}
          >
            {discovering ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Debug-Info zeigen
          </button>
        </div>
      )}

      {debugInfo && (
        <details
          className="rounded-[18px] border p-4 text-[12px]"
          style={cardSubtleStyle}
          open
        >
          <summary
            className="cursor-pointer text-[13px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            CalDAV-Debug — bitte komplett kopieren und an Claude schicken
          </summary>
          <div className="mt-3 space-y-2" style={{ color: "var(--text-secondary)" }}>
            <p>
              <strong>Start-URL:</strong> {debugInfo.startUrl}
            </p>
            <p>
              <strong>Principal-URL:</strong> {debugInfo.principalUrl ?? "—"}
            </p>
            <p>
              <strong>Home-Hrefs:</strong> {debugInfo.homeHrefs.join(", ") || "—"}
            </p>
            <p>
              <strong>Roh-Kandidaten:</strong> {debugInfo.rawCandidates.length}
            </p>
            <pre
              className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] border p-3 text-[11px]"
              style={{
                borderColor: "rgba(226, 218, 209, 0.95)",
                backgroundColor: "#fbf7f1",
                color: "var(--text-primary)",
              }}
            >
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                setInfo("Debug-Info in die Zwischenablage kopiert.");
              }}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold"
              style={{
                borderColor: "rgba(226, 218, 209, 0.95)",
                color: "var(--text-secondary)",
              }}
            >
              In Zwischenablage kopieren
            </button>
          </div>
        </details>
      )}

      {lastResult && lastResult.appliedEvents.length > 0 && (
        <div className="rounded-[18px] border p-5 space-y-3" style={cardSubtleStyle}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Verbucht beim letzten Sync
          </p>
          <div className="space-y-1.5">
            {lastResult.appliedEvents.map((ev) => (
              <div
                key={ev.uid}
                className="flex items-center justify-between gap-3 text-[12.5px]"
              >
                <span style={{ color: "var(--text-primary)" }}>{ev.summary}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatMinutes(ev.durationMinutes)} → {ev.taskTitle}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastResult && lastResult.unmatchedEvents.length > 0 && (
        <div className="rounded-[18px] border p-5 space-y-3" style={cardSubtleStyle}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Ohne passende Task übersprungen
          </p>
          <div className="space-y-1.5">
            {lastResult.unmatchedEvents.map((ev) => (
              <div
                key={ev.uid}
                className="flex items-center justify-between gap-3 text-[12.5px]"
              >
                <span style={{ color: "var(--text-secondary)" }}>{ev.summary}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {formatMinutes(ev.durationMinutes)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Lege eine Task mit passendem Namen an und führe den Sync erneut aus.
          </p>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-[14px] border p-3"
      style={{ borderColor: "rgba(226, 218, 209, 0.95)" }}
    >
      <div className="space-y-1">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-[11.5px] leading-5" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: checked
            ? "var(--accent-primary)"
            : "rgba(217, 209, 200, 0.82)",
        }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-150"
          style={{ left: checked ? "calc(100% - 24px)" : "4px" }}
        />
      </button>
    </div>
  );
}

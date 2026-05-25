"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Clock3, PauseCircle, PlayCircle } from "lucide-react";
import {
  createTimeEntry,
  formatCompactDuration,
  formatCompactMinutes,
  formatElapsed,
  formatSeconds,
  minutesToSeconds,
  secondsToMinutes,
} from "@/lib/time-tracking";
import { useTimeTrackingStore } from "@/stores/timeTrackingStore";
import type { AnalyticsTaskOption, TimeEntry } from "@/types";

interface TimeTrackingPanelProps {
  tasks: AnalyticsTaskOption[];
  entries: TimeEntry[];
}

const COLOR_PRIMARY = "var(--text-primary)";
const COLOR_SECONDARY = "var(--text-secondary)";
const COLOR_MUTED = "var(--text-muted)";
const COLOR_ACCENT = "var(--accent-primary)";

const block: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "20px 22px 22px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(89, 72, 48, 0.04)",
};

const blockHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 14,
};

const blockTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const blockHint: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "-0.015em",
};

const grid2: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "16px 18px",
  border: "1px solid #efe8e0",
  borderRadius: 8,
  background: "#fdfbf7",
};

const panelLabel: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: 36,
  padding: "6px 10px",
  border: "1px solid #e4ddd6",
  borderRadius: 8,
  background: "#ffffff",
  color: COLOR_PRIMARY,
  fontSize: 13,
  outline: "none",
};

const minutesFieldStyle: CSSProperties = {
  ...fieldStyle,
  width: 96,
  flexShrink: 0,
};

const clockStyle: CSSProperties = {
  marginTop: 4,
  color: COLOR_PRIMARY,
  fontSize: 34,
  fontWeight: 700,
  letterSpacing: "-0.06em",
  fontVariantNumeric: "tabular-nums",
};

const captionStyle: CSSProperties = {
  color: COLOR_SECONDARY,
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  marginTop: 6,
  minHeight: 36,
  padding: "0 14px",
  border: "1px solid #ddd6ce",
  borderRadius: 8,
  background: "#ffffff",
  color: COLOR_PRIMARY,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  cursor: "pointer",
};

const buttonStart: CSSProperties = {
  ...buttonBase,
  border: "1px solid transparent",
  background: COLOR_ACCENT,
  color: "#ffffff",
};

const buttonStop: CSSProperties = {
  ...buttonBase,
  border: "1px solid transparent",
  background: "#d8a566",
  color: "#ffffff",
};

const messageStyle: CSSProperties = {
  color: COLOR_ACCENT,
  fontSize: 12,
  fontWeight: 600,
};

const entryRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderTop: "1px solid #f5f0e9",
};

const entryTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const entryMeta: CSSProperties = {
  marginTop: 2,
  color: COLOR_MUTED,
  fontSize: 11,
};

const entryValue: CSSProperties = {
  flexShrink: 0,
  padding: "3px 9px",
  borderRadius: 999,
  background: "rgba(244, 239, 232, 0.85)",
  color: COLOR_SECONDARY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.015em",
};

function getEntryMinutes(entry: TimeEntry) {
  if (typeof entry.duration === "number" && Number.isFinite(entry.duration)) {
    return secondsToMinutes(entry.duration);
  }

  if (entry.endTime) {
    const diff = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
    return Math.max(0, diff / 60000);
  }

  return 0;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function TimeTrackingPanel({
  tasks,
  entries,
}: TimeTrackingPanelProps) {
  const [selectedTaskIdState, setSelectedTaskIdState] = useState("");
  const [manualTaskIdState, setManualTaskIdState] = useState("");
  const [manualMinutes, setManualMinutes] = useState("45");
  const [manualStartedAt, setManualStartedAt] = useState(() =>
    toDateTimeLocalValue(new Date())
  );
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const runningTimer = useTimeTrackingStore((state) => state.runningTimer);
  const submitting = useTimeTrackingStore((state) => state.submitting);
  const startTimer = useTimeTrackingStore((state) => state.startTimer);
  const stopTimer = useTimeTrackingStore((state) => state.stopTimer);
  const selectedTaskId =
    selectedTaskIdState && tasks.some((task) => task.id === selectedTaskIdState)
      ? selectedTaskIdState
      : tasks[0]?.id ?? "";
  const manualTaskId =
    manualTaskIdState && tasks.some((task) => task.id === manualTaskIdState)
      ? manualTaskIdState
      : tasks[0]?.id ?? "";

  useEffect(() => {
    if (!runningTimer) return undefined;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runningTimer]);

  function handleStartTimer() {
    if (!selectedTaskId || runningTimer) return;
    setMessage(null);
    setNow(Date.now());
    void startTimer(selectedTaskId);
  }

  async function handleStopTimer() {
    if (!runningTimer) return;

    setMessage(null);

    const result = await stopTimer();
    if (!result) return;

    setMessage(result.persisted ? "Timer gespeichert" : "Timer lokal übernommen");
  }

  async function handleManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualTaskId || !manualStartedAt || !manualMinutes) return;

    const durationMinutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

    const startTime = new Date(manualStartedAt).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
    const duration = durationMinutes * 60;

    setMessage(null);

    try {
      const result = await createTimeEntry({
        taskId: manualTaskId,
        startTime,
        endTime,
        duration,
      });
      setMessage(result.persisted ? "Zeitblock gespeichert" : "Zeitblock lokal übernommen");
      setManualStartedAt(toDateTimeLocalValue(new Date()));
    } catch {
      setMessage("Zeitblock konnte nicht erstellt werden");
    }
  }

  const runningTask = tasks.find((task) => task.id === runningTimer?.taskId);
  const runningTaskBaseSeconds = minutesToSeconds(runningTask?.actualTime ?? 0);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedTaskBaseSeconds = minutesToSeconds(selectedTask?.actualTime ?? 0);
  const recentEntries = [...entries]
    .sort((first, second) => new Date(second.startTime).getTime() - new Date(first.startTime).getTime())
    .slice(0, 5);
  const totalTrackedMinutes = entries.reduce((sum, entry) => sum + getEntryMinutes(entry), 0);

  return (
    <section style={block}>
      <header style={blockHeader}>
        <h2 style={blockTitle}>Zeiterfassung</h2>
        <span style={blockHint}>
          {entries.length} Einträge · {formatCompactMinutes(totalTrackedMinutes)} gesamt
        </span>
      </header>

      <div style={grid2}>
        <div style={panelStyle}>
          <p style={panelLabel}>Aktiver Timer</p>

          <select
            value={selectedTaskId}
            onChange={(event) => setSelectedTaskIdState(event.target.value)}
            disabled={Boolean(runningTimer)}
            style={fieldStyle}
          >
            {tasks.length === 0 && <option value="">Keine Aufgaben</option>}
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          <p style={clockStyle}>
            {runningTimer
              ? formatElapsed(runningTimer.startedAt, now, runningTaskBaseSeconds)
              : formatSeconds(selectedTaskBaseSeconds)}
          </p>
          <p style={captionStyle}>
            {runningTask?.title ?? selectedTask?.title ?? "Keine Aufgabe ausgewählt"}
          </p>

          {runningTimer ? (
            <button
              type="button"
              onClick={handleStopTimer}
              disabled={submitting}
              style={{ ...buttonStop, opacity: submitting ? 0.55 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              <PauseCircle size={15} />
              Timer stoppen
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTimer}
              disabled={!selectedTaskId || submitting}
              style={{
                ...buttonStart,
                opacity: !selectedTaskId || submitting ? 0.55 : 1,
                cursor: !selectedTaskId || submitting ? "not-allowed" : "pointer",
              }}
            >
              <PlayCircle size={15} />
              Timer starten
            </button>
          )}
        </div>

        <form onSubmit={handleManualEntry} style={panelStyle}>
          <p style={panelLabel}>Manuell nachtragen</p>

          <select
            value={manualTaskId}
            onChange={(event) => setManualTaskIdState(event.target.value)}
            style={fieldStyle}
          >
            {tasks.length === 0 && <option value="">Keine Aufgaben</option>}
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="datetime-local"
              value={manualStartedAt}
              onChange={(event) => setManualStartedAt(event.target.value)}
              style={fieldStyle}
            />
            <input
              type="number"
              min={5}
              step={5}
              value={manualMinutes}
              onChange={(event) => setManualMinutes(event.target.value)}
              style={minutesFieldStyle}
              aria-label="Dauer in Minuten"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !manualTaskId}
            style={{
              ...buttonBase,
              opacity: submitting || !manualTaskId ? 0.55 : 1,
              cursor: submitting || !manualTaskId ? "not-allowed" : "pointer",
            }}
          >
            <Clock3 size={14} />
            Eintrag speichern
          </button>

          {message && <p style={messageStyle}>{message}</p>}
        </form>
      </div>

      {recentEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, borderTop: "1px solid #f1ebe4" }}>
          <p style={panelLabel}>Letzte Sessions</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" }}>
            {recentEntries.map((entry, index) => {
              const task = tasks.find((item) => item.id === entry.taskId);
              return (
                <li
                  key={entry.id}
                  style={{ ...entryRow, borderTop: index === 0 ? "0" : "1px solid #f5f0e9" }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={entryTitle}>{task?.title ?? "Unbekannte Aufgabe"}</p>
                    <p style={entryMeta}>
                      {format(parseISO(entry.startTime), "EEE, d. MMM · HH:mm", { locale: de })}
                    </p>
                  </div>
                  <span style={entryValue}>
                    {formatCompactDuration(entry.duration ?? 0)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

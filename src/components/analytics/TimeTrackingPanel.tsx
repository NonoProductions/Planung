"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Clock3, LayoutGrid, PauseCircle, PlayCircle, TimerReset } from "lucide-react";
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

    setMessage(result.persisted ? "Timer gespeichert" : "Timer lokal uebernommen");
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
      setMessage(result.persisted ? "Zeitblock gespeichert" : "Zeitblock lokal uebernommen");
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
  const averageSessionMinutes =
    entries.length > 0 ? totalTrackedMinutes / entries.length : 0;
  const activeTaskCount = new Set(entries.map((entry) => entry.taskId)).size;

  return (
    <section className="workspace-surface workspace-section analytics-time-panel flex flex-col gap-5">
      <div className="workspace-section__header">
        <div className="workspace-section__intro">
          <p className="workspace-section__eyebrow">Zeiterfassung</p>
          <h2 className="workspace-section__title">Timer oder manueller Log</h2>
          <p className="workspace-section__copy">
            Direkt aus der Analytics-Ansicht starten, stoppen oder spaeter sauber
            nachtragen.
          </p>
        </div>

        <span className="workspace-badge">
          <Clock3 size={13} />
          {entries.length} Eintraege
        </span>
      </div>

      <div className="analytics-time-grid">
        <div className="analytics-time-stat">
          <p className="analytics-time-stat__eyebrow">Getrackt</p>
          <p className="analytics-time-stat__value">{formatCompactMinutes(totalTrackedMinutes)}</p>
          <p className="analytics-time-stat__detail">im gewaehlten Zeitraum</p>
        </div>

        <div className="analytics-time-stat">
          <p className="analytics-time-stat__eyebrow">Tasks beruehrt</p>
          <p className="analytics-time-stat__value">{activeTaskCount}</p>
          <p className="analytics-time-stat__detail">mit mindestens einer Session</p>
        </div>

        <div className="analytics-time-stat">
          <p className="analytics-time-stat__eyebrow">Session-Schnitt</p>
          <p className="analytics-time-stat__value">
            {averageSessionMinutes > 0 ? formatCompactMinutes(averageSessionMinutes) : "0s"}
          </p>
          <p className="analytics-time-stat__detail">durchschnittlich pro Eintrag</p>
        </div>
      </div>

      <div className="workspace-surface workspace-surface--warning workspace-section analytics-timer-card">
        <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          Aktiver Timer
        </p>

        <div className="mt-6 flex flex-col gap-6">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Aufgabe
            </span>
            <select
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskIdState(event.target.value)}
              disabled={Boolean(runningTimer)}
              className="workspace-input"
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p
                className="text-[38px] font-semibold leading-[0.95] tracking-[-0.065em]"
                style={{ color: "var(--text-primary)" }}
              >
                {runningTimer
                  ? formatElapsed(runningTimer.startedAt, now, runningTaskBaseSeconds)
                  : formatSeconds(selectedTaskBaseSeconds)}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {runningTask?.title ?? selectedTask?.title ?? "Keine Aufgabe ausgewaehlt"}
              </p>
            </div>

            {runningTimer ? (
              <button
                type="button"
                onClick={handleStopTimer}
                disabled={submitting}
                className="workspace-button workspace-button--warning min-w-[180px]"
              >
                <PauseCircle size={16} />
                Timer stoppen
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={!selectedTaskId || submitting}
                className="workspace-button workspace-button--primary min-w-[180px]"
              >
                <PlayCircle size={16} />
                Timer starten
              </button>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleManualEntry}
        className="workspace-surface workspace-section workspace-surface--soft analytics-manual-card"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Manuell erfassen
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Ideal fuer nachgetragenes Tracking oder Meetings.
            </p>
          </div>

          <span className="workspace-badge workspace-badge--accent">
            <TimerReset size={12} />
            Schnelllog
          </span>
        </div>

        <div className="analytics-manual-grid mt-6">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Aufgabe
            </span>
            <select
              value={manualTaskId}
              onChange={(event) => setManualTaskIdState(event.target.value)}
              className="workspace-input"
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Dauer in Minuten
            </span>
            <input
              type="number"
              min={5}
              step={5}
              value={manualMinutes}
              onChange={(event) => setManualMinutes(event.target.value)}
              className="workspace-input"
            />
          </label>
        </div>

        <label className="mt-5 flex flex-col gap-2">
          <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
            Startzeit
          </span>
          <input
            type="datetime-local"
            value={manualStartedAt}
            onChange={(event) => setManualStartedAt(event.target.value)}
            className="workspace-input"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !manualTaskId}
          className="workspace-button workspace-button--success mt-6 self-start"
        >
          <Clock3 size={15} />
          Eintrag speichern
        </button>
      </form>

      <div className="workspace-surface workspace-section analytics-entry-panel">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Letzte Sessions
          </p>
          {message && (
            <span className="text-[11px] font-medium" style={{ color: "var(--accent-primary)" }}>
              {message}
            </span>
          )}
        </div>

        <div className="analytics-entry-list mt-6 flex flex-col gap-4">
          {recentEntries.length > 0 ? (
            recentEntries.map((entry) => {
              const task = tasks.find((item) => item.id === entry.taskId);
              return (
                <div key={entry.id} className="workspace-list-item analytics-entry-item">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="truncate text-[13px] font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {task?.title ?? "Unbekannte Aufgabe"}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {format(parseISO(entry.startTime), "EEE, d. MMM - HH:mm", { locale: de })}
                      </p>
                    </div>

                    <span className="workspace-badge">
                      <LayoutGrid size={12} />
                      {formatCompactDuration(entry.duration ?? 0)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="workspace-empty h-full">
              Noch keine Time Entries fuer diese Woche vorhanden.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

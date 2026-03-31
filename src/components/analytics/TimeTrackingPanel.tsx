"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Clock3, PauseCircle, PlayCircle, TimerReset } from "lucide-react";
import type { AnalyticsTaskOption, TimeEntry } from "@/types";

const RUNNING_TIMER_KEY = "sunsama-running-timer";

interface RunningTimerState {
  taskId: string;
  startedAt: string;
}

interface TimeTrackingPanelProps {
  tasks: AnalyticsTaskOption[];
  entries: TimeEntry[];
  onEntryCreated: (entry: TimeEntry) => void;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDurationFromSeconds(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  return formatMinutes(totalMinutes);
}

function formatElapsed(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
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
  onEntryCreated,
}: TimeTrackingPanelProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [manualTaskId, setManualTaskId] = useState("");
  const [manualMinutes, setManualMinutes] = useState("45");
  const [manualStartedAt, setManualStartedAt] = useState(() =>
    toDateTimeLocalValue(new Date())
  );
  const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tasks.length) return;

    setSelectedTaskId((current) =>
      current && tasks.some((task) => task.id === current) ? current : tasks[0].id
    );
    setManualTaskId((current) =>
      current && tasks.some((task) => task.id === current) ? current : tasks[0].id
    );
  }, [tasks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(RUNNING_TIMER_KEY);
    if (!persisted) return;

    try {
      const parsed = JSON.parse(persisted) as RunningTimerState;
      if (parsed.taskId && parsed.startedAt) {
        setRunningTimer(parsed);
      }
    } catch {
      window.localStorage.removeItem(RUNNING_TIMER_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (runningTimer) {
      window.localStorage.setItem(RUNNING_TIMER_KEY, JSON.stringify(runningTimer));
      const timer = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(timer);
    }

    window.localStorage.removeItem(RUNNING_TIMER_KEY);
    setNow(Date.now());
  }, [runningTimer]);

  async function persistEntry(payload: {
    taskId: string;
    startTime: string;
    endTime: string;
    duration: number;
  }) {
    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("time-entry-save-failed");
    }

    return response.json() as Promise<TimeEntry>;
  }

  function handleStartTimer() {
    if (!selectedTaskId || runningTimer) return;
    setMessage(null);
    setRunningTimer({
      taskId: selectedTaskId,
      startedAt: new Date().toISOString(),
    });
  }

  async function handleStopTimer() {
    if (!runningTimer) return;

    const startTime = runningTimer.startedAt;
    const endTime = new Date().toISOString();
    const duration = Math.max(
      60,
      Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    );

    setSubmitting(true);
    setMessage(null);

    try {
      const createdEntry = await persistEntry({
        taskId: runningTimer.taskId,
        startTime,
        endTime,
        duration,
      });
      onEntryCreated(createdEntry);
      setMessage("Timer gespeichert");
    } catch {
      onEntryCreated({
        id: `local-${Date.now()}`,
        taskId: runningTimer.taskId,
        startTime,
        endTime,
        duration,
      });
      setMessage("Timer lokal übernommen");
    } finally {
      setRunningTimer(null);
      setSubmitting(false);
    }
  }

  async function handleManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualTaskId || !manualStartedAt || !manualMinutes) return;

    const durationMinutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

    const startTime = new Date(manualStartedAt).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
    const duration = durationMinutes * 60;

    setSubmitting(true);
    setMessage(null);

    try {
      const createdEntry = await persistEntry({
        taskId: manualTaskId,
        startTime,
        endTime,
        duration,
      });
      onEntryCreated(createdEntry);
      setMessage("Zeitblock gespeichert");
      setManualStartedAt(toDateTimeLocalValue(new Date()));
    } catch {
      onEntryCreated({
        id: `local-${Date.now()}`,
        taskId: manualTaskId,
        startTime,
        endTime,
        duration,
      });
      setMessage("Zeitblock lokal übernommen");
    } finally {
      setSubmitting(false);
    }
  }

  const runningTask = tasks.find((task) => task.id === runningTimer?.taskId);
  const recentEntries = entries.slice(0, 5);

  return (
    <section className="workspace-surface workspace-section flex h-full min-h-0 flex-col gap-5">
      <div className="workspace-section__header">
        <div className="workspace-section__intro">
          <p className="workspace-section__eyebrow">Zeiterfassung</p>
          <h2 className="workspace-section__title">Timer oder manueller Log</h2>
        </div>

        <span className="workspace-badge">
          <Clock3 size={13} />
          {entries.length} Eintraege
        </span>
      </div>

      <div className="workspace-surface workspace-surface--warning workspace-section">
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
              onChange={(event) => setSelectedTaskId(event.target.value)}
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
                {runningTimer ? formatElapsed(runningTimer.startedAt, now) : "00:00:00"}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {runningTask ? runningTask.title : "Keine Aufgabe ausgewaehlt"}
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
        className="workspace-surface workspace-section workspace-surface--soft"
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

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Aufgabe
            </span>
            <select
              value={manualTaskId}
              onChange={(event) => setManualTaskId(event.target.value)}
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

      <div className="workspace-surface workspace-section min-h-[280px] flex-1">
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

        <div className="mt-6 flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {recentEntries.length > 0 ? (
            recentEntries.map((entry) => {
              const task = tasks.find((item) => item.id === entry.taskId);
              return (
                <div key={entry.id} className="workspace-list-item">
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
                      {formatDurationFromSeconds(entry.duration ?? 0)}
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

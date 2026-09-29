"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Clock3, PauseCircle, PlayCircle } from "lucide-react";
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
    <div className="analytics-tracking">
      <div className="settings-row">
        <p className="settings-row__label">Timer</p>
        <select
          value={selectedTaskId}
          onChange={(event) => setSelectedTaskId(event.target.value)}
          disabled={Boolean(runningTimer)}
          className="workspace-input settings-input"
          aria-label="Aufgabe fuer den Timer"
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="analytics-timer">
              {runningTimer ? formatElapsed(runningTimer.startedAt, now) : "00:00:00"}
            </p>
            <p className="settings-row__description truncate">
              {runningTask ? runningTask.title : "Kein Timer aktiv"}
            </p>
          </div>
          {runningTimer ? (
            <button
              type="button"
              onClick={handleStopTimer}
              disabled={submitting}
              className="workspace-button workspace-button--warning"
            >
              <PauseCircle size={15} />
              Stoppen
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTimer}
              disabled={!selectedTaskId || submitting}
              className="workspace-button workspace-button--primary"
            >
              <PlayCircle size={15} />
              Starten
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleManualEntry} className="settings-row">
        <p className="settings-row__label">Manuell erfassen</p>
        <select
          value={manualTaskId}
          onChange={(event) => setManualTaskId(event.target.value)}
          className="workspace-input settings-input"
          aria-label="Aufgabe"
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={manualStartedAt}
            onChange={(event) => setManualStartedAt(event.target.value)}
            className="workspace-input settings-input min-w-0 flex-1"
            aria-label="Startzeit"
          />
          <input
            type="number"
            min={5}
            step={5}
            value={manualMinutes}
            onChange={(event) => setManualMinutes(event.target.value)}
            className="workspace-input analytics-minutes"
            aria-label="Dauer in Minuten"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !manualTaskId}
          className="workspace-button self-start"
        >
          <Clock3 size={14} />
          Eintrag speichern
        </button>
      </form>

      <div className="settings-block">
        <div className="flex items-center justify-between gap-3">
          <p className="settings-row__label">Letzte Sessions</p>
          {message && (
            <span className="text-[11px] font-semibold" style={{ color: "var(--accent-primary)" }}>
              {message}
            </span>
          )}
        </div>
        {recentEntries.length > 0 ? (
          recentEntries.map((entry) => {
            const task = tasks.find((item) => item.id === entry.taskId);
            return (
              <div key={entry.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {task?.title ?? "Unbekannte Aufgabe"}
                  </p>
                  <p className="settings-row__description">
                    {format(parseISO(entry.startTime), "EEE, d. MMM - HH:mm", { locale: de })}
                  </p>
                </div>
                <span className="planning-card__duration">
                  {formatDurationFromSeconds(entry.duration ?? 0)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="settings-row__description">Noch keine Sessions in dieser Woche.</p>
        )}
      </div>
    </div>
  );
}

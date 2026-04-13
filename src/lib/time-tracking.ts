"use client";

import type { TimeEntry } from "@/types";

export const RUNNING_TIMER_STORAGE_KEY = "sunsama-running-timer";
export const TIME_ENTRY_CREATED_EVENT = "sunsama-time-entry-created";

export interface RunningTimerState {
  entryId: string;
  taskId: string;
  startedAt: string;
}

export interface TimeEntryPayload {
  taskId: string;
  startTime: string;
  endTime: string;
  duration: number;
}

export interface TimeEntryResult {
  entry: TimeEntry;
  persisted: boolean;
}

export function getElapsedSeconds(startedAt: string, now: number, offsetSeconds = 0) {
  return Math.max(
    0,
    offsetSeconds + Math.floor((now - new Date(startedAt).getTime()) / 1000)
  );
}

export function secondsToMinutes(seconds: number) {
  return Math.max(0, seconds) / 60;
}

export function minutesToSeconds(minutes: number) {
  return Math.max(0, Math.round(minutes * 60));
}

export function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatElapsed(startedAt: string, now: number, offsetSeconds = 0) {
  return formatSeconds(getElapsedSeconds(startedAt, now, offsetSeconds));
}

export function formatCompactDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${remainingSeconds}s`;
}

export function formatCompactMinutes(minutes: number) {
  return formatCompactDuration(minutesToSeconds(minutes));
}

export function toRunningTimerState(entry: TimeEntry): RunningTimerState {
  return {
    entryId: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startTime,
  };
}

export function buildRunningTimeEntryFallback(taskId: string, startTime: string): TimeEntry {
  return {
    id: `running-${Date.now()}`,
    taskId,
    startTime,
    duration: 0,
    status: "running",
  };
}

export function buildCompletedTimeEntryFallback(payload: TimeEntryPayload): TimeEntry {
  return {
    id: `local-${Date.now()}`,
    taskId: payload.taskId,
    startTime: payload.startTime,
    endTime: payload.endTime,
    duration: payload.duration,
    status: "completed",
  };
}

export function dispatchTimeEntryCreated(entry: TimeEntry) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<TimeEntry>(TIME_ENTRY_CREATED_EVENT, {
      detail: entry,
    })
  );
}

export async function fetchActiveTimeEntry(): Promise<TimeEntry | null> {
  const response = await fetch("/api/time-entries?active=true", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("time-entry-active-fetch-failed");
  }

  return (await response.json()) as TimeEntry | null;
}

export async function startRunningTimeEntry(taskId: string): Promise<TimeEntryResult> {
  const startTime = new Date().toISOString();

  try {
    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        taskId,
        startTime,
      }),
    });

    if (!response.ok) {
      throw new Error("time-entry-start-failed");
    }

    const entry = (await response.json()) as TimeEntry;
    return {
      entry,
      persisted: response.headers.get("x-time-entry-persisted") !== "false",
    };
  } catch {
    return {
      entry: buildRunningTimeEntryFallback(taskId, startTime),
      persisted: false,
    };
  }
}

export async function stopRunningTimeEntry(entryId: string): Promise<TimeEntryResult> {
  const response = await fetch(`/api/time-entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "stop" }),
  });

  if (!response.ok) {
    throw new Error("time-entry-stop-failed");
  }

  const entry = (await response.json()) as TimeEntry;
  dispatchTimeEntryCreated(entry);

  return {
    entry,
    persisted: response.headers.get("x-time-entry-persisted") !== "false",
  };
}

export async function createTimeEntry(
  payload: TimeEntryPayload
): Promise<TimeEntryResult> {
  try {
    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("time-entry-save-failed");
    }

    const entry = (await response.json()) as TimeEntry;
    dispatchTimeEntryCreated(entry);

    return {
      entry,
      persisted: response.headers.get("x-time-entry-persisted") !== "false",
    };
  } catch {
    const fallbackEntry = buildCompletedTimeEntryFallback(payload);
    dispatchTimeEntryCreated(fallbackEntry);
    return { entry: fallbackEntry, persisted: false };
  }
}

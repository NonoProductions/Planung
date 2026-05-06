"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, TimerReset, X } from "lucide-react";
import { toLocalDateTimeString } from "@/lib/date";
import {
  POMODORO_LONG_BREAK_MINUTES,
  POMODORO_SHORT_BREAK_MINUTES,
  POMODORO_WORK_MINUTES,
  POMODOROS_PER_GROUP,
  buildPomodoroPlan,
} from "@/lib/pomodoro";
import type { Task } from "@/types";

interface TaskScheduleFormProps {
  task: Task;
  selectedDate: string;
  hasExistingPomodoroBreaks?: boolean;
  onSave: (data: {
    scheduledDate: string;
    scheduledStart: string;
    scheduledEnd: string;
    plannedTime: number;
    pomodoroSplit: boolean;
  }) => void;
  onUnschedule: () => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

function toTimeInputValue(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const safeMinutes = Math.max(0, Math.min(value, 23 * 60 + 59));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function addMinutes(value: string, minutes: number) {
  return minutesToTime(timeToMinutes(value) + minutes);
}

function getDurationMinutes(startTime: string, endTime: string) {
  return Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime));
}

export default function TaskScheduleForm({
  task,
  selectedDate,
  hasExistingPomodoroBreaks = false,
  onSave,
  onUnschedule,
  onClose,
  position,
}: TaskScheduleFormProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const initialDate = task.scheduledDate || selectedDate;
  const initialStartTime = toTimeInputValue(task.scheduledStart) || "09:00";
  // When the task already has Pomodoro breaks, scheduledEnd includes break time.
  // Use task.plannedTime (pure work minutes) to avoid inflating the duration on each save.
  const initialDuration =
    hasExistingPomodoroBreaks && task.plannedTime
      ? task.plannedTime
      : task.scheduledStart && task.scheduledEnd
        ? getDurationMinutes(
            toTimeInputValue(task.scheduledStart),
            toTimeInputValue(task.scheduledEnd)
          )
        : task.plannedTime || 60;
  const initialEndTime = addMinutes(initialStartTime, initialDuration);

  const [scheduleDate, setScheduleDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [plannedTime, setPlannedTime] = useState(initialDuration);
  const [pomodoroSplit, setPomodoroSplit] = useState(hasExistingPomodoroBreaks);
  const [showHint, setShowHint] = useState(false);

  const isScheduled = Boolean(task.scheduledStart && task.scheduledEnd);

  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const durationLabel = useMemo(() => {
    const hours = Math.floor(plannedTime / 60);
    const minutes = plannedTime % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }, [plannedTime]);

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setEndTime(addMinutes(value, plannedTime));
  };

  const handleEndTimeChange = (value: string) => {
    const nextDuration = getDurationMinutes(startTime, value);
    setEndTime(value);
    setPlannedTime(nextDuration);
  };

  const handlePlannedTimeChange = (value: string) => {
    const nextMinutes = Math.max(15, parseInt(value, 10) || 15);
    setPlannedTime(nextMinutes);
    setEndTime(addMinutes(startTime, nextMinutes));
  };

  const pomodoroPreview = useMemo(() => {
    if (!pomodoroSplit) return null;
    const plan = buildPomodoroPlan(plannedTime);
    const workUnits = plan.blocks.filter((block) => block.type === "work").length;
    const breaks = plan.breaks.length;
    const longBreaks = plan.breaks.filter(
      (block) => block.durationMinutes === POMODORO_LONG_BREAK_MINUTES
    ).length;
    const shortBreaks = breaks - longBreaks;
    return { workUnits, breaks, shortBreaks, longBreaks, totalSpan: plan.totalSpanMinutes };
  }, [pomodoroSplit, plannedTime]);

  const handleSubmit = () => {
    const nextDuration = getDurationMinutes(startTime, endTime);

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setShowHint(true);
      return;
    }

    setShowHint(false);

    // When pomodoro split is on, the calendar span is work + breaks; the parent
    // expands the end accordingly. Here we still send the plain start/end based
    // on plannedTime (work minutes only) and let the parent compute the span.
    const finalStart = toLocalDateTimeString(
      new Date(`${scheduleDate}T${startTime}:00`)
    );
    const finalEnd = pomodoroSplit
      ? toLocalDateTimeString(
          new Date(
            new Date(`${scheduleDate}T${startTime}:00`).getTime() +
              buildPomodoroPlan(nextDuration).totalSpanMinutes * 60_000
          )
        )
      : toLocalDateTimeString(new Date(`${scheduleDate}T${endTime}:00`));

    onSave({
      scheduledDate: scheduleDate,
      scheduledStart: finalStart,
      scheduledEnd: finalEnd,
      plannedTime: nextDuration,
      pomodoroSplit,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }

    if (event.key === "Escape") {
      onClose();
    }
  };

  const inputBaseStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-input)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const labelStyle: React.CSSProperties = {
    color: "var(--text-muted)",
    letterSpacing: "0.14em",
  };

  return (
    <div
      ref={formRef}
      data-calendar-form
      className="absolute z-50 flex flex-col overflow-hidden"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width: 340,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100dvh - 24px)",
        borderRadius: 16,
        border: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        boxShadow:
          "0 1px 2px rgba(76, 70, 63, 0.04), 0 24px 56px rgba(76, 70, 63, 0.18)",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      <header
        className="flex items-start justify-between gap-3"
        style={{ padding: "14px 18px 12px 18px" }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] font-semibold uppercase"
            style={labelStyle}
          >
            Task planen
          </p>
          <h3
            className="mt-1.5 break-words text-[16px] font-semibold leading-[1.2]"
            style={{
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {task.title}
          </h3>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "var(--bg-hover)",
                color: "var(--text-secondary)",
              }}
            >
              <Clock3 size={10} />
              {durationLabel}
            </span>
            {task.channel && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${task.channel.color}18`,
                  color: task.channel.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: task.channel.color }}
                />
                {task.channel.name}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={14} />
        </button>
      </header>

      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: "var(--border-subtle)",
          margin: "0 18px",
        }}
      />

      <div
        className="min-h-0 overflow-y-auto"
        style={{ padding: "12px 18px 14px 18px" }}
      >
        <div className="space-y-3">
          <div>
            <label
              className="flex items-center gap-1 text-[9px] font-semibold uppercase"
              style={labelStyle}
            >
              <CalendarDays size={10} />
              Tag
            </label>
            <input
              ref={dateRef}
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              onKeyDown={handleKeyDown}
              className="event-form-input mt-1.5 w-full rounded-[8px] text-[12px]"
              style={{
                ...inputBaseStyle,
                color: "var(--text-secondary)",
                padding: "8px 10px",
              }}
            />
          </div>

          <div>
            <label
              className="block text-[9px] font-semibold uppercase"
              style={labelStyle}
            >
              Zeit
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div
                className="rounded-[8px]"
                style={{
                  ...inputBaseStyle,
                  padding: "6px 8px",
                }}
              >
                <p
                  className="text-[8px] font-semibold uppercase"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.1em",
                  }}
                >
                  Start
                </p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => handleStartTimeChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-0.5 w-full bg-transparent text-[13px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <div
                className="rounded-[8px]"
                style={{
                  ...inputBaseStyle,
                  padding: "6px 8px",
                }}
              >
                <p
                  className="text-[8px] font-semibold uppercase"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.1em",
                  }}
                >
                  Ende
                </p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => handleEndTimeChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-0.5 w-full bg-transparent text-[13px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>
          </div>

          <div>
            <label
              className="flex items-center gap-1 text-[9px] font-semibold uppercase"
              style={labelStyle}
            >
              <TimerReset size={10} />
              Geplante Dauer
            </label>
            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
              <div
                className="flex items-center gap-2 rounded-[8px]"
                style={{
                  ...inputBaseStyle,
                  padding: "7px 10px",
                }}
              >
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={plannedTime}
                  onChange={(event) =>
                    handlePlannedTimeChange(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-[12px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Min.
                </span>
              </div>
              <div
                className="flex items-center justify-center rounded-[8px] px-3"
                style={{
                  backgroundColor: "var(--accent-primary-light)",
                  color: "var(--accent-primary)",
                  minWidth: 90,
                }}
              >
                <span className="text-[12px] font-semibold">
                  {durationLabel}
                </span>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setPomodoroSplit((value) => !value)}
              className="flex w-full items-center justify-between gap-2 rounded-[8px] text-left transition-colors"
              style={{
                ...inputBaseStyle,
                padding: "7px 10px",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                  style={{
                    backgroundColor: pomodoroSplit
                      ? "var(--accent-primary-light)"
                      : "var(--bg-hover)",
                  }}
                >
                  🍅
                </span>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Pomodoro aufteilen
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase"
                style={{
                  backgroundColor: pomodoroSplit
                    ? "var(--accent-primary-light)"
                    : "var(--bg-hover)",
                  color: pomodoroSplit
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                  letterSpacing: "0.1em",
                }}
              >
                {pomodoroSplit ? "An" : "Aus"}
              </span>
            </button>

            {pomodoroPreview && (
              <p
                className="mt-1.5 text-[10px] leading-[1.4]"
                style={{ color: "var(--text-muted)" }}
              >
                {pomodoroPreview.workUnits}× {POMODORO_WORK_MINUTES} Min Arbeit
                {pomodoroPreview.breaks > 0
                  ? ` · ${pomodoroPreview.shortBreaks}× ${POMODORO_SHORT_BREAK_MINUTES} Min Pause · ${pomodoroPreview.longBreaks}× ${POMODORO_LONG_BREAK_MINUTES} Min Pause nach je ${POMODOROS_PER_GROUP} Einheiten`
                  : ""}
                {" · gesamt "}
                {Math.floor(pomodoroPreview.totalSpan / 60) > 0
                  ? `${Math.floor(pomodoroPreview.totalSpan / 60)} h `
                  : ""}
                {pomodoroPreview.totalSpan % 60 > 0
                  ? `${pomodoroPreview.totalSpan % 60} min`
                  : ""}
              </p>
            )}
          </div>

          {showHint && (
            <p
              className="rounded-[8px] px-3 py-2 text-[11px] font-medium leading-[1.4]"
              style={{
                backgroundColor: "var(--accent-warning-light)",
                color: "#ad7419",
              }}
            >
              Das Ende muss nach dem Start liegen.
            </p>
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: "var(--border-subtle)",
          margin: "0 18px",
        }}
      />

      <footer style={{ padding: "10px 18px 12px 18px" }}>
        {isScheduled ? (
          <>
            <button
              type="button"
              onClick={onUnschedule}
              className="w-full rounded-[8px] py-1.5 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: "transparent",
                color: "var(--accent-danger)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Aus Kalender entfernen
            </button>
            <div
              aria-hidden="true"
              style={{
                height: 1,
                background: "var(--border-subtle)",
                margin: "8px 0",
              }}
            />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] py-2 text-[12px] font-semibold transition-colors"
            style={{
              backgroundColor: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-[8px] py-2 text-[12px] font-semibold text-white"
            style={{
              background: "var(--accent-primary)",
              boxShadow: "0 6px 14px rgba(141, 124, 246, 0.28)",
            }}
          >
            Planen
          </button>
        </div>
      </footer>
    </div>
  );
}

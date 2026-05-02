"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, TimerReset, X } from "lucide-react";
import { toLocalDateTimeString } from "@/lib/date";
import type { Task } from "@/types";

interface TaskScheduleFormProps {
  task: Task;
  selectedDate: string;
  onSave: (data: {
    scheduledDate: string;
    scheduledStart: string;
    scheduledEnd: string;
    plannedTime: number;
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
  onSave,
  onUnschedule,
  onClose,
  position,
}: TaskScheduleFormProps) {
  const dateRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const initialDate = task.scheduledDate || selectedDate;
  const initialStartTime = toTimeInputValue(task.scheduledStart) || "09:00";
  const initialDuration =
    task.scheduledStart && task.scheduledEnd
      ? getDurationMinutes(
          toTimeInputValue(task.scheduledStart),
          toTimeInputValue(task.scheduledEnd)
        )
      : task.plannedTime || 60;
  const initialEndTime =
    toTimeInputValue(task.scheduledEnd) || addMinutes(initialStartTime, initialDuration);

  const [scheduleDate, setScheduleDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [plannedTime, setPlannedTime] = useState(initialDuration);
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

  const handleSubmit = () => {
    const nextDuration = getDurationMinutes(startTime, endTime);

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setShowHint(true);
      return;
    }

    setShowHint(false);

    onSave({
      scheduledDate: scheduleDate,
      scheduledStart: toLocalDateTimeString(
        new Date(`${scheduleDate}T${startTime}:00`)
      ),
      scheduledEnd: toLocalDateTimeString(
        new Date(`${scheduleDate}T${endTime}:00`)
      ),
      plannedTime: nextDuration,
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
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "min(560px, calc(100dvh - 40px))",
        borderRadius: 18,
        border: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        boxShadow:
          "0 1px 2px rgba(76, 70, 63, 0.04), 0 24px 56px rgba(76, 70, 63, 0.18)",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      <header
        className="flex items-start justify-between gap-4"
        style={{ padding: "24px 28px 20px 28px" }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase"
            style={labelStyle}
          >
            Task planen
          </p>
          <h3
            className="mt-3 break-words text-[22px] font-semibold leading-[1.2]"
            style={{
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {task.title}
          </h3>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--bg-hover)",
                color: "var(--text-secondary)",
              }}
            >
              <Clock3 size={12} />
              {durationLabel}
            </span>
            {task.channel && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={16} />
        </button>
      </header>

      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: "var(--border-subtle)",
          margin: "0 28px",
        }}
      />

      <div
        className="min-h-0 overflow-y-auto"
        style={{ padding: "22px 28px 24px 28px" }}
      >
        <div className="space-y-6">
          <div>
            <label
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase"
              style={labelStyle}
            >
              <CalendarDays size={11} />
              Tag
            </label>
            <input
              ref={dateRef}
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              onKeyDown={handleKeyDown}
              className="event-form-input mt-2.5 w-full rounded-[10px] text-[13px]"
              style={{
                ...inputBaseStyle,
                color: "var(--text-secondary)",
                padding: "12px 14px",
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={labelStyle}
            >
              Zeit
            </label>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div
                className="rounded-[10px]"
                style={{
                  ...inputBaseStyle,
                  padding: "10px 12px",
                }}
              >
                <p
                  className="text-[9px] font-semibold uppercase"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.12em",
                  }}
                >
                  Start
                </p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => handleStartTimeChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 w-full bg-transparent text-[15px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <div
                className="rounded-[10px]"
                style={{
                  ...inputBaseStyle,
                  padding: "10px 12px",
                }}
              >
                <p
                  className="text-[9px] font-semibold uppercase"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.12em",
                  }}
                >
                  Ende
                </p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => handleEndTimeChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 w-full bg-transparent text-[15px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>
          </div>

          <div>
            <label
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase"
              style={labelStyle}
            >
              <TimerReset size={11} />
              Geplante Dauer
            </label>
            <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-3">
              <div
                className="flex items-center gap-2 rounded-[10px]"
                style={{
                  ...inputBaseStyle,
                  padding: "10px 14px",
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
                  className="w-full bg-transparent text-[14px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                <span
                  className="text-[12px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Min.
                </span>
              </div>
              <div
                className="flex items-center justify-center rounded-[10px] px-4"
                style={{
                  backgroundColor: "var(--accent-primary-light)",
                  color: "var(--accent-primary)",
                  minWidth: 110,
                }}
              >
                <span className="text-[13px] font-semibold">
                  {durationLabel}
                </span>
              </div>
            </div>
          </div>

          {showHint && (
            <p
              className="rounded-[10px] px-4 py-3 text-[12px] font-medium leading-[1.5]"
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
          margin: "0 28px",
        }}
      />

      <footer style={{ padding: "18px 28px 22px 28px" }}>
        {isScheduled ? (
          <>
            <button
              type="button"
              onClick={onUnschedule}
              className="w-full rounded-[10px] py-2.5 text-[12px] font-semibold transition-colors"
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
                margin: "16px 0",
              }}
            />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] py-3 text-[13px] font-semibold transition-colors"
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
            className="rounded-[10px] py-3 text-[13px] font-semibold text-white"
            style={{
              background: "var(--accent-primary)",
              boxShadow: "0 8px 18px rgba(141, 124, 246, 0.28)",
            }}
          >
            Planen
          </button>
        </div>
      </footer>
    </div>
  );
}

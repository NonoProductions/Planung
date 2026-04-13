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

  return (
    <div
      ref={formRef}
      data-calendar-form
      className="absolute z-50 flex flex-col overflow-hidden rounded-[12px] border shadow-xl"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width: 336,
        maxWidth: "calc(100% - 20px)",
        maxHeight: "min(560px, calc(100dvh - 40px))",
        background:
          "linear-gradient(180deg, rgba(255,253,250,0.99) 0%, rgba(247,242,235,0.98) 100%)",
        borderColor: "rgba(226, 218, 208, 0.98)",
        boxShadow: "0 24px 52px rgba(82, 67, 48, 0.16)",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b px-5 py-5"
        style={{ borderColor: "rgba(229, 222, 214, 0.98)" }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Task planen
          </p>
          <h3
            className="mt-2 break-words text-[20px] font-semibold leading-[1.08] tracking-[-0.04em]"
            style={{ color: "var(--text-primary)" }}
          >
            {task.title}
          </h3>
          <p className="mt-2 text-[12px] leading-[1.45]" style={{ color: "var(--text-muted)" }}>
            Lege Tag, Start und Dauer direkt im Kalender fest.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border transition-colors"
          style={{
            color: "var(--text-muted)",
            borderColor: "rgba(226, 218, 208, 0.92)",
            backgroundColor: "rgba(255,255,255,0.88)",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
        <div
          className="rounded-[10px] border px-5 py-5"
          style={{
            borderColor: "rgba(229, 222, 214, 0.98)",
            background:
              "linear-gradient(180deg, rgba(240, 235, 255, 0.58), rgba(255, 255, 255, 0.96))",
          }}
        >
          <p
            className="break-words text-[15px] font-semibold leading-[1.35]"
            style={{ color: "var(--text-primary)" }}
          >
            {task.title}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                color: "var(--text-secondary)",
              }}
            >
              <Clock3 size={11} />
              {durationLabel}
            </span>
            {task.channel && (
              <span
                className="inline-flex items-center rounded-[8px] px-3 py-2 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${task.channel.color}18`,
                  color: task.channel.color,
                }}
              >
                #{task.channel.name}
              </span>
            )}
          </div>
        </div>

        <section
          className="space-y-3 rounded-[10px] border px-5 py-5"
          style={{
            backgroundColor: "rgba(255,255,255,0.9)",
            borderColor: "rgba(229, 222, 214, 0.98)",
          }}
        >
          <label className="block">
            <span
              className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              <CalendarDays size={11} />
              Tag
            </span>
            <input
              ref={dateRef}
              type="date"
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-[8px] border px-4 py-3.5 text-[13px] outline-none"
              style={{
                backgroundColor: "rgba(250, 246, 241, 0.92)",
                borderColor: "rgba(226, 218, 208, 0.92)",
                color: "var(--text-secondary)",
              }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label
              className="rounded-[8px] border px-4 py-3.5"
              style={{
                backgroundColor: "rgba(250, 246, 241, 0.92)",
                borderColor: "rgba(226, 218, 208, 0.92)",
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Start
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => handleStartTimeChange(event.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-1.5 w-full bg-transparent text-[15px] font-semibold outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </label>

            <label
              className="rounded-[8px] border px-4 py-3.5"
              style={{
                backgroundColor: "rgba(250, 246, 241, 0.92)",
                borderColor: "rgba(226, 218, 208, 0.92)",
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Ende
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => handleEndTimeChange(event.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-1.5 w-full bg-transparent text-[15px] font-semibold outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-end">
            <label className="block">
              <span
                className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                <TimerReset size={11} />
                Geplante Dauer (Min.)
              </span>
              <input
                type="number"
                min={15}
                step={15}
                value={plannedTime}
                onChange={(event) => handlePlannedTimeChange(event.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-[8px] border px-4 py-3.5 text-[13px] outline-none"
                style={{
                  backgroundColor: "rgba(250, 246, 241, 0.92)",
                  borderColor: "rgba(226, 218, 208, 0.92)",
                  color: "var(--text-secondary)",
                }}
              />
            </label>

            <div
              className="rounded-[8px] border px-4 py-3.5"
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                borderColor: "rgba(229, 222, 214, 0.98)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Dauer
              </p>
              <p className="mt-1 text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {durationLabel}
              </p>
            </div>
          </div>

          {showHint && (
            <p
              className="rounded-[8px] px-3.5 py-3 text-[11px] font-medium leading-[1.45]"
              style={{
                backgroundColor: "var(--accent-warning-light)",
                color: "#ad7419",
              }}
            >
              Das Ende muss nach dem Start liegen.
            </p>
          )}
        </section>
      </div>

      <div
        className="space-y-3 border-t px-5 py-5"
        style={{ borderColor: "rgba(229, 222, 214, 0.98)" }}
      >
        {isScheduled ? (
          <button
            type="button"
            onClick={onUnschedule}
            className="w-full rounded-[8px] px-4 py-3 text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              color: "var(--accent-danger)",
              border: "1px solid rgba(232, 215, 215, 0.96)",
            }}
          >
            Aus Kalender entfernen
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] px-4 py-3 text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: "rgba(244, 239, 232, 0.92)",
              color: "var(--text-muted)",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-[8px] px-4 py-3 text-[11px] font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--accent-primary) 0%, rgba(112, 92, 232, 0.92) 100%)",
              boxShadow: "0 10px 20px rgba(141, 124, 246, 0.22)",
            }}
          >
            Planen
          </button>
        </div>
      </div>
    </div>
  );
}

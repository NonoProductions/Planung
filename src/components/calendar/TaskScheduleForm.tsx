"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import CalendarPopover, {
  isPhoneViewport,
  type PopoverAnchor,
} from "@/components/calendar/CalendarPopover";
import TimeInput from "@/components/ui/TimeInput";
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
  anchor: PopoverAnchor;
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
  anchor,
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

  // The popover stays hidden until it has been positioned, so focus on the next frame.
  // Not on phones: focusing would pop up the date picker right away.
  useEffect(() => {
    if (isPhoneViewport()) return undefined;
    const frame = requestAnimationFrame(() => dateRef.current?.focus());
    return () => cancelAnimationFrame(frame);
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
      scheduledStart: new Date(`${scheduleDate}T${startTime}:00`).toISOString(),
      scheduledEnd: new Date(`${scheduleDate}T${endTime}:00`).toISOString(),
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
    <CalendarPopover anchor={anchor} width={336} panelRef={formRef}>
      <div className="popover-panel__header">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock size={16} strokeWidth={2} style={{ color: "var(--accent-primary)" }} />
          <span className="settings-toolbar__title truncate">Task planen</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="planning-toolbar__button planning-toolbar__button--icon"
          aria-label="Schließen"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="popover-panel__body">
        <div className="settings-row">
          <p className="popover-title-input break-words">{task.title}</p>
          <div className="flex flex-wrap gap-2">
            <span className="planning-card__duration">{durationLabel}</span>
            {task.channel && (
              <span className="planning-card__duration" style={{ color: task.channel.color }}>
                #{task.channel.name}
              </span>
            )}
          </div>
        </div>

        <div className="settings-row">
          <p className="settings-row__label">Tag</p>
          <input
            ref={dateRef}
            type="date"
            value={scheduleDate}
            onChange={(event) => setScheduleDate(event.target.value)}
            onKeyDown={handleKeyDown}
            className="workspace-input"
          />
        </div>

        <div className="settings-row">
          <p className="settings-row__label">Zeit</p>
          <div className="grid grid-cols-2 gap-2">
            <TimeInput
              value={startTime}
              onChange={handleStartTimeChange}
              onKeyDown={handleKeyDown}
              aria-label="Start"
            />
            <TimeInput
              value={endTime}
              onChange={handleEndTimeChange}
              onKeyDown={handleKeyDown}
              aria-label="Ende"
            />
          </div>
          {showHint && (
            <p className="settings-notice" style={{ margin: 0, background: "var(--accent-warning-light)", color: "var(--warning-text)" }}>
              Das Ende muss nach dem Start liegen.
            </p>
          )}
        </div>

        <div className="settings-row settings-row--inline">
          <div className="settings-row__text">
            <p className="settings-row__label">Geplante Dauer</p>
            <p className="settings-row__description">In Minuten</p>
          </div>
          <input
            type="number"
            min={15}
            step={15}
            value={plannedTime}
            onChange={(event) => handlePlannedTimeChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="workspace-input text-center"
            style={{ width: 88 }}
          />
        </div>
      </div>

      <div className="popover-panel__footer">
        {isScheduled ? (
          <button
            type="button"
            onClick={onUnschedule}
            className="workspace-button settings-danger-button w-full"
          >
            Aus Kalender entfernen
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="workspace-button">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="workspace-button workspace-button--primary"
          >
            Planen
          </button>
        </div>
      </div>
    </CalendarPopover>
  );
}

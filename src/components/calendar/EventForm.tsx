"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Trash2, X } from "lucide-react";
import CalendarPopover, { type PopoverAnchor } from "@/components/calendar/CalendarPopover";
import TimeInput from "@/components/ui/TimeInput";
import type { CalendarCategory, CalendarEvent, RecurringRule } from "@/types";

const EVENT_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

const DAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface EventFormProps {
  event?: CalendarEvent;
  defaultStart?: string;
  defaultEnd?: string;
  selectedDate: string;
  calendarCategories?: CalendarCategory[];
  onSave: (data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    color: string;
    isRecurring: boolean;
    recurringRule?: RecurringRule | null;
    calendarCategoryId?: string;
  }) => void;
  /** When set, a new entry can be created as a task instead of an event. */
  onCreateTask?: (data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
  anchor: PopoverAnchor;
}

function parseIsoTime(value: string) {
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

function formatDurationLabel(startTime: string, endTime: string) {
  const totalMinutes = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatDateLabel(selectedDate: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${selectedDate}T12:00:00`));
}

export default function EventForm({
  event,
  defaultStart = "09:00",
  defaultEnd = "10:00",
  selectedDate,
  calendarCategories = [],
  onSave,
  onCreateTask,
  onDelete,
  onClose,
  anchor,
}: EventFormProps) {
  const isEditing = !!event;
  const canCreateTask = !isEditing && !!onCreateTask;
  const [kind, setKind] = useState<"task" | "event">(canCreateTask ? "task" : "event");
  const isTask = canCreateTask && kind === "task";
  const existingRule = event?.recurringRule;

  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [startTime, setStartTime] = useState(
    event ? parseIsoTime(event.startTime) : defaultStart
  );
  const [endTime, setEndTime] = useState(
    event ? parseIsoTime(event.endTime) : defaultEnd
  );
  const [color, setColor] = useState(event?.color || EVENT_COLORS[0]);
  const [calendarCategoryId, setCalendarCategoryId] = useState(
    event?.calendarCategoryId || ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [frequency, setFrequency] = useState<"none" | "daily" | "weekly" | "monthly">(
    event?.isRecurring
      ? ((existingRule?.frequency as "daily" | "weekly" | "monthly") ?? "weekly")
      : "none"
  );
  const [interval, setInterval] = useState(existingRule?.interval ?? 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existingRule?.daysOfWeek ?? []
  );
  const [endDate, setEndDate] = useState(existingRule?.endDate ?? "");
  const [showRecurring, setShowRecurring] = useState(event?.isRecurring ?? false);

  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // The popover stays hidden until it has been positioned, so focus on the next frame.
  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleClick = (mouseEvent: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(mouseEvent.target as Node)) {
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

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((previous) =>
      previous.includes(day)
        ? previous.filter((value) => value !== day)
        : [...previous, day]
    );
  };

  const selectedCategory = calendarCategories.find(
    (category) => category.id === calendarCategoryId
  );
  const durationLabel = useMemo(
    () => formatDurationLabel(startTime, endTime),
    [startTime, endTime]
  );
  const isRecurringEnabled = showRecurring && frequency !== "none";

  const frequencyLabel: Record<string, string> = {
    none: "Nie",
    daily: "Täglich",
    weekly: "Wöchentlich",
    monthly: "Monatlich",
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const startISO = new Date(`${selectedDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${selectedDate}T${endTime}:00`).toISOString();

    if (isTask) {
      onCreateTask?.({
        title: title.trim(),
        description: description || undefined,
        startTime: startISO,
        endTime: endISO,
      });
      return;
    }

    const isRecurring = isRecurringEnabled;

    const recurringRule: RecurringRule | null = isRecurring
      ? {
          frequency: frequency as "daily" | "weekly" | "monthly",
          interval: interval > 1 ? interval : undefined,
          daysOfWeek:
            frequency === "weekly" && daysOfWeek.length > 0
              ? daysOfWeek
              : undefined,
          endDate: endDate || undefined,
        }
      : null;

    onSave({
      title: title.trim(),
      description: description || undefined,
      startTime: startISO,
      endTime: endISO,
      color,
      isRecurring,
      recurringRule,
      calendarCategoryId: calendarCategoryId || undefined,
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

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.();
      return;
    }

    setConfirmDelete(true);
    setTimeout(() => setConfirmDelete(false), 3000);
  };

  return (
    <CalendarPopover anchor={anchor} width={360} panelRef={formRef}>
      <div className="popover-panel__header">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} strokeWidth={2} style={{ color: "var(--accent-primary)" }} />
          <span className="settings-toolbar__title truncate">
            {isEditing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
          </span>
          <span className="planning-card__duration">{formatDateLabel(selectedDate)}</span>
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
        {canCreateTask && (
          <div className="settings-segmented settings-segmented--compact" role="radiogroup">
            {(["task", "event"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className="settings-segmented__option"
              >
                {value === "task" ? "Task" : "Termin"}
              </button>
            ))}
          </div>
        )}

        <div className="settings-row">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Worum geht es?"
            className="popover-title-input"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Notiz (optional)"
            rows={3}
            className="workspace-input workspace-input--textarea"
          />
        </div>

        <div className="settings-row">
          <div className="flex items-center justify-between gap-3">
            <p className="settings-row__label">Zeit</p>
            <span className="planning-card__duration">{durationLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TimeInput
              value={startTime}
              onChange={setStartTime}
              onKeyDown={handleKeyDown}
              aria-label="Start"
            />
            <TimeInput
              value={endTime}
              onChange={setEndTime}
              onKeyDown={handleKeyDown}
              aria-label="Ende"
            />
          </div>
        </div>

        {!isTask && (
          <>
            <div className="settings-row">
              <p className="settings-row__label">Kalender</p>
              <div className="flex w-full items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedCategory?.color || "var(--track-fill)" }}
                />
                <select
                  value={calendarCategoryId}
                  onChange={(event) => setCalendarCategoryId(event.target.value)}
                  className="workspace-input"
                >
                  <option value="">Kein Kalender</option>
                  {calendarCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-row settings-row--inline">
              <p className="settings-row__label">Farbe</p>
              <div className="color-swatch-row" role="radiogroup" aria-label="Farbe">
                {EVENT_COLORS.map((eventColor) => (
                  <button
                    key={eventColor}
                    type="button"
                    role="radio"
                    aria-checked={color === eventColor}
                    aria-label={eventColor}
                    onClick={() => setColor(eventColor)}
                    className="color-swatch"
                    style={{ backgroundColor: eventColor, color: eventColor }}
                  />
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row--inline flex">
                <div className="settings-row__text">
                  <p className="settings-row__label">Wiederholung</p>
                  <p className="settings-row__description">
                    {isRecurringEnabled ? frequencyLabel[frequency] : "Nur einmalig"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showRecurring}
                  aria-label="Wiederholung"
                  onClick={() => setShowRecurring((value) => !value)}
                  className="settings-switch"
                >
                  <span className="settings-switch__thumb" />
                </button>
              </div>

              {showRecurring && (
                <>
                  <div className="settings-segmented settings-segmented--compact" role="radiogroup">
                    {(["none", "daily", "weekly", "monthly"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={frequency === value}
                        onClick={() => setFrequency(value)}
                        className="settings-segmented__option"
                      >
                        {frequencyLabel[value]}
                      </button>
                    ))}
                  </div>

                  {frequency !== "none" && (
                    <div className="flex items-center gap-2">
                      <span className="settings-row__description" style={{ marginTop: 0 }}>
                        Alle
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={interval}
                        onChange={(event) =>
                          setInterval(Math.max(1, parseInt(event.target.value, 10) || 1))
                        }
                        className="workspace-input text-center"
                        style={{ width: 64 }}
                      />
                      <span className="settings-row__description" style={{ marginTop: 0 }}>
                        {frequency === "daily"
                          ? "Tag(e)"
                          : frequency === "weekly"
                            ? "Woche(n)"
                            : "Monat(e)"}
                      </span>
                    </div>
                  )}

                  {frequency === "weekly" && (
                    <div className="settings-segmented settings-segmented--compact">
                      {DAY_LABELS.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          role="checkbox"
                          aria-checked={daysOfWeek.includes(index)}
                          onClick={() => toggleDayOfWeek(index)}
                          className="settings-segmented__option"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {frequency !== "none" && (
                    <div className="flex items-center gap-2">
                      <span className="settings-row__description" style={{ marginTop: 0 }}>
                        Endet
                      </span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="workspace-input"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="popover-panel__footer">
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            className={`workspace-button settings-danger-button w-full ${
              confirmDelete ? "settings-danger-button--armed" : ""
            }`}
          >
            <Trash2 size={13} />
            {confirmDelete ? "Bestätigen?" : "Löschen"}
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="workspace-button">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="workspace-button workspace-button--primary"
          >
            {isEditing ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </div>
    </CalendarPopover>
  );
}

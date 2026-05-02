"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
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
  onDelete?: () => void;
  onClose: () => void;
  position?: { top: number; left: number };
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
  onDelete,
  onClose,
  position,
}: EventFormProps) {
  const isEditing = !!event;
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

  useEffect(() => {
    titleRef.current?.focus();
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
    const isRecurring = isRecurringEnabled;
    const recurringRule: RecurringRule | null = isRecurring
      ? {
          frequency: frequency as "daily" | "weekly" | "monthly",
          interval: interval > 1 ? interval : undefined,
          daysOfWeek:
            frequency === "weekly" && daysOfWeek.length > 0 ? daysOfWeek : undefined,
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

  const inputBaseStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-input)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const fieldLabelStyle: React.CSSProperties = {
    color: "var(--text-muted)",
    letterSpacing: "0.14em",
  };

  return (
    <motion.div
      ref={formRef}
      data-calendar-form
      className="absolute z-50 flex flex-col overflow-hidden"
      initial={{ opacity: 0, scale: 0.97, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 4 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "min(640px, calc(100dvh - 40px))",
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
        style={{
          padding: "24px 28px 20px 28px",
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase"
            style={fieldLabelStyle}
          >
            {isEditing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
          </p>
          <h3
            className="mt-3 break-words text-[22px] font-semibold leading-[1.2]"
            style={{
              color: title.trim() ? "var(--text-primary)" : "var(--text-muted)",
              letterSpacing: "-0.02em",
            }}
          >
            {title.trim() || "Kalendereintrag"}
          </h3>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--bg-hover)",
                color: "var(--text-secondary)",
              }}
            >
              <CalendarDays size={12} />
              {formatDateLabel(selectedDate)}
            </span>
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
        style={{
          padding: "22px 28px 24px 28px",
        }}
      >
        <div className="space-y-6">
          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={fieldLabelStyle}
            >
              Titel
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Worum geht es?"
              className="event-form-input mt-2.5 w-full rounded-[10px] text-[14px]"
              style={{
                ...inputBaseStyle,
                padding: "12px 14px",
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={fieldLabelStyle}
            >
              Notiz
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Optionaler Kontext"
              rows={3}
              className="event-form-input mt-2.5 w-full resize-none rounded-[10px] text-[13px] leading-[1.55]"
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
              style={fieldLabelStyle}
            >
              Zeit
            </label>
            <div className="mt-2.5 grid grid-cols-3 gap-3">
              <div
                className="rounded-[10px]"
                style={{
                  ...inputBaseStyle,
                  padding: "10px 12px",
                }}
              >
                <p
                  className="text-[9px] font-semibold uppercase"
                  style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}
                >
                  Start
                </p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 w-full bg-transparent text-[14px] font-medium outline-none"
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
                  style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}
                >
                  Ende
                </p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 w-full bg-transparent text-[14px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <div
                className="rounded-[10px]"
                style={{
                  backgroundColor: `${color}14`,
                  border: `1px solid ${color}33`,
                  padding: "10px 12px",
                }}
              >
                <p
                  className="text-[9px] font-semibold uppercase"
                  style={{ color, opacity: 0.75, letterSpacing: "0.12em" }}
                >
                  Dauer
                </p>
                <p
                  className="mt-1 text-[14px] font-medium"
                  style={{ color }}
                >
                  {durationLabel}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={fieldLabelStyle}
            >
              Kalender
            </label>
            <div
              className="relative mt-2.5 flex items-center gap-2.5 rounded-[10px]"
              style={{
                ...inputBaseStyle,
                padding: "12px 14px",
              }}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    selectedCategory?.color || "var(--text-muted)",
                }}
              />
              <select
                value={calendarCategoryId}
                onChange={(event) => setCalendarCategoryId(event.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent pr-5 text-[13px] outline-none"
                style={{ color: "var(--text-secondary)" }}
              >
                <option value="">Kein Kalender</option>
                {calendarCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3.5"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={fieldLabelStyle}
            >
              Farbe
            </label>
            <div className="mt-2.5 grid grid-cols-8 gap-2">
              {EVENT_COLORS.map((eventColor) => {
                const isSelected = color === eventColor;
                return (
                  <button
                    key={eventColor}
                    type="button"
                    onClick={() => setColor(eventColor)}
                    aria-label={`Farbe ${eventColor}`}
                    className="relative flex h-9 w-full items-center justify-center rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: eventColor,
                      boxShadow: isSelected
                        ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${eventColor}`
                        : "none",
                    }}
                  >
                    {isSelected && (
                      <Check size={12} color="white" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold uppercase"
              style={fieldLabelStyle}
            >
              Wiederholung
            </label>
            <button
              type="button"
              onClick={() => setShowRecurring((value) => !value)}
              className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-[10px] text-left transition-colors"
              style={{
                ...inputBaseStyle,
                padding: "12px 14px",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: showRecurring
                      ? "var(--accent-primary-light)"
                      : "var(--bg-hover)",
                    color: showRecurring
                      ? "var(--accent-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  <RefreshCw size={13} />
                </span>
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {showRecurring ? frequencyLabel[frequency] : "Nur einmalig"}
                </span>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase"
                style={{
                  backgroundColor: showRecurring
                    ? "var(--accent-primary-light)"
                    : "var(--bg-hover)",
                  color: showRecurring
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                  letterSpacing: "0.1em",
                }}
              >
                {showRecurring ? "An" : "Aus"}
              </span>
            </button>

            {showRecurring && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {(["none", "daily", "weekly", "monthly"] as const).map((value) => {
                    const active = frequency === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFrequency(value)}
                        className="rounded-[8px] py-2.5 text-[11px] font-semibold transition-colors"
                        style={{
                          backgroundColor: active
                            ? "var(--accent-primary)"
                            : "var(--bg-hover)",
                          color: active ? "#ffffff" : "var(--text-secondary)",
                        }}
                      >
                        {frequencyLabel[value]}
                      </button>
                    );
                  })}
                </div>

                {frequency !== "none" && (
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Alle
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={interval}
                      onChange={(event) =>
                        setInterval(
                          Math.max(1, parseInt(event.target.value, 10) || 1)
                        )
                      }
                      className="event-form-input w-16 rounded-[8px] text-center text-[13px] font-medium"
                      style={{
                        ...inputBaseStyle,
                        padding: "8px 10px",
                      }}
                    />
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {frequency === "daily"
                        ? "Tag(e)"
                        : frequency === "weekly"
                          ? "Woche(n)"
                          : "Monat(e)"}
                    </span>
                  </div>
                )}

                {frequency === "weekly" && (
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_LABELS.map((label, index) => {
                      const active = daysOfWeek.includes(index);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDayOfWeek(index)}
                          className="rounded-[8px] py-2 text-[11px] font-semibold transition-colors"
                          style={{
                            backgroundColor: active
                              ? "var(--accent-primary)"
                              : "var(--bg-hover)",
                            color: active ? "#ffffff" : "var(--text-secondary)",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {frequency !== "none" && (
                  <div className="flex items-center gap-3">
                    <span
                      className="shrink-0 text-[12px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Endet am
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="event-form-input flex-1 rounded-[8px] text-[13px]"
                      style={{
                        ...inputBaseStyle,
                        color: "var(--text-secondary)",
                        padding: "10px 12px",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
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

      <footer
        style={{
          padding: "18px 28px 22px 28px",
        }}
      >
        {isEditing && onDelete ? (
          <>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: confirmDelete
                  ? "var(--accent-danger-light)"
                  : "transparent",
                color: confirmDelete
                  ? "var(--accent-danger)"
                  : "var(--text-muted)",
                border: `1px solid ${
                  confirmDelete
                    ? "rgba(224, 111, 111, 0.3)"
                    : "var(--border-subtle)"
                }`,
              }}
            >
              <Trash2 size={12} />
              {confirmDelete ? "Wirklich löschen?" : "Eintrag löschen"}
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
            disabled={!title.trim()}
            className="rounded-[10px] py-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{
              background: color,
              boxShadow: `0 8px 18px ${color}33`,
            }}
          >
            {isEditing ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </footer>
    </motion.div>
  );
}

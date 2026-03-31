"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  Palette,
  RefreshCw,
  Trash2,
  Type,
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
    daily: "Taeglich",
    weekly: "Woechentlich",
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
    <div
      ref={formRef}
      data-calendar-form
      className="absolute z-50 flex flex-col overflow-hidden rounded-[12px] border shadow-xl"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width: 360,
        maxWidth: "calc(100% - 20px)",
        maxHeight: "min(720px, calc(100dvh - 40px))",
        background:
          "linear-gradient(180deg, rgba(255,253,250,0.995) 0%, rgba(247,242,235,0.985) 100%)",
        borderColor: "rgba(228, 221, 214, 0.98)",
        boxShadow: "0 24px 52px rgba(82, 67, 48, 0.16)",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      <div
        className="border-b px-5 py-5"
        style={{
          borderColor: "rgba(229, 222, 214, 0.98)",
          background: `linear-gradient(180deg, ${color}14 0%, rgba(255,255,255,0.72) 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              {isEditing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </p>
            <h3
              className="mt-2 break-words text-[22px] font-semibold leading-[1.04] tracking-[-0.05em]"
              style={{ color: "var(--text-primary)" }}
            >
              {title.trim() || "Kalendereintrag"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border transition-colors"
            style={{
              backgroundColor: "rgba(255,255,255,0.88)",
              borderColor: "rgba(226, 218, 208, 0.92)",
              color: "var(--text-muted)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[10px] font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              color: "var(--text-secondary)",
            }}
          >
            <CalendarDays size={11} />
            {formatDateLabel(selectedDate)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[10px] font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              color: "var(--text-secondary)",
            }}
          >
            <Clock3 size={11} />
            {startTime} - {endTime}
          </span>
          <span
            className="inline-flex items-center rounded-[8px] px-3 py-2 text-[10px] font-semibold"
            style={{
              backgroundColor: `${color}18`,
              color,
            }}
          >
            {durationLabel}
          </span>
          {selectedCategory ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,0.92)",
                color: selectedCategory.color,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedCategory.color }}
              />
              {selectedCategory.name}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
        <section
          className="space-y-3 rounded-[10px] border px-5 py-5"
          style={{
            backgroundColor: "rgba(255,255,255,0.9)",
            borderColor: "rgba(232, 225, 217, 0.98)",
          }}
        >
          <div className="space-y-1.5">
            <label
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              <Type size={11} />
              Titel
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Worum geht es?"
              className="w-full rounded-[8px] border px-4 py-3.5 text-[14px] outline-none"
              style={{
                backgroundColor: "rgba(250, 246, 241, 0.92)",
                borderColor: "rgba(228, 221, 214, 0.92)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              <AlignLeft size={11} />
              Notiz
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Optionaler Kontext"
              rows={4}
              className="w-full resize-none rounded-[8px] border px-4 py-3.5 text-[13px] leading-[1.5] outline-none"
              style={{
                backgroundColor: "rgba(250, 246, 241, 0.92)",
                borderColor: "rgba(228, 221, 214, 0.92)",
                color: "var(--text-secondary)",
              }}
            />
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section
            className="rounded-[10px] border px-5 py-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              borderColor: "rgba(232, 225, 217, 0.98)",
            }}
          >
            <div className="mb-3">
              <p
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                <Clock3 size={11} />
                Zeit
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div
                className="rounded-[8px] border px-4 py-3.5"
                style={{
                  backgroundColor: "rgba(250, 246, 241, 0.92)",
                  borderColor: "rgba(228, 221, 214, 0.92)",
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Start
                </p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1.5 w-full bg-transparent text-[15px] font-semibold outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>

              <div
                className="rounded-[8px] border px-4 py-3.5"
                style={{
                  backgroundColor: "rgba(250, 246, 241, 0.92)",
                  borderColor: "rgba(228, 221, 214, 0.92)",
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ende
                </p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1.5 w-full bg-transparent text-[15px] font-semibold outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div
              className="mt-3 rounded-[8px] border px-4 py-3.5"
              style={{
                backgroundColor: "rgba(255,255,255,0.94)",
                borderColor: "rgba(232, 225, 217, 0.98)",
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
          </section>

          <section
            className="space-y-3 rounded-[10px] border px-5 py-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              borderColor: "rgba(232, 225, 217, 0.98)",
            }}
          >
            <div className="space-y-1.5">
              <label
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                <CalendarDays size={11} />
                Kalender
              </label>
              <div
                className="relative flex items-center gap-2 rounded-[8px] border px-4 py-3.5"
                style={{
                  backgroundColor: "rgba(250, 246, 241, 0.92)",
                  borderColor: "rgba(228, 221, 214, 0.92)",
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: selectedCategory?.color || "rgba(178,170,161,0.55)",
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
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                <Palette size={11} />
                Farbe
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {EVENT_COLORS.map((eventColor) => (
                  <button
                    key={eventColor}
                    type="button"
                    onClick={() => setColor(eventColor)}
                    className="h-12 w-full rounded-[8px] border transition-all"
                    style={{
                      backgroundColor: eventColor,
                      borderColor: color === eventColor ? "#ffffff" : "transparent",
                      boxShadow:
                        color === eventColor
                          ? `0 0 0 2px ${eventColor}, 0 8px 18px ${eventColor}30`
                          : "0 4px 10px rgba(77, 66, 54, 0.08)",
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        <section
              className="rounded-[10px] border px-5 py-5"
          style={{
            backgroundColor: "rgba(255,255,255,0.9)",
            borderColor: showRecurring
              ? "rgba(141, 124, 246, 0.28)"
              : "rgba(232, 225, 217, 0.98)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowRecurring((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[8px]"
                style={{
                  backgroundColor: showRecurring
                    ? "var(--accent-primary-light)"
                    : "rgba(244, 239, 232, 0.92)",
                  color: showRecurring ? "var(--accent-primary)" : "var(--text-muted)",
                }}
              >
                <RefreshCw size={14} />
              </span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Wiederholung
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {showRecurring ? frequencyLabel[frequency] : "Nur einmalig"}
                </p>
              </div>
            </div>
            <span
              className="rounded-[8px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: showRecurring
                  ? "rgba(141, 124, 246, 0.12)"
                  : "rgba(244, 239, 232, 0.92)",
                color: showRecurring ? "var(--accent-primary)" : "var(--text-muted)",
              }}
            >
              {showRecurring ? "An" : "Aus"}
            </span>
          </button>

          {showRecurring && (
            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(["none", "daily", "weekly", "monthly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFrequency(value)}
                    className="rounded-[8px] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      backgroundColor:
                        frequency === value ? "var(--accent-primary)" : "rgba(244, 239, 232, 0.92)",
                      color: frequency === value ? "#ffffff" : "var(--text-muted)",
                    }}
                  >
                    {frequencyLabel[value]}
                  </button>
                ))}
              </div>

              {frequency !== "none" && (
                <div className="grid gap-3 sm:grid-cols-[auto_72px_1fr] sm:items-center">
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
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
                    className="rounded-[8px] border px-3 py-2.5 text-center text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(250, 246, 241, 0.92)",
                      borderColor: "rgba(228, 221, 214, 0.92)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
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
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDayOfWeek(index)}
                      className="rounded-[6px] px-1.5 py-2.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: daysOfWeek.includes(index)
                          ? "var(--accent-primary)"
                          : "rgba(244, 239, 232, 0.92)",
                        color: daysOfWeek.includes(index) ? "#ffffff" : "var(--text-muted)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {frequency !== "none" && (
                <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    Endet
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="rounded-[8px] border px-3.5 py-2.5 text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(250, 246, 241, 0.92)",
                      borderColor: "rgba(228, 221, 214, 0.92)",
                      color: "var(--text-secondary)",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div
        className="space-y-3 border-t px-5 py-5"
        style={{ borderColor: "rgba(229, 222, 214, 0.98)" }}
      >
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] px-4 py-3 text-[11px] font-semibold"
            style={{
              backgroundColor: confirmDelete
                ? "var(--accent-danger-light)"
                : "rgba(255,255,255,0.92)",
              color: confirmDelete ? "var(--accent-danger)" : "var(--text-muted)",
              border: "1px solid rgba(232, 215, 215, 0.96)",
            }}
          >
            <Trash2 size={12} />
            {confirmDelete ? "Bestaetigen?" : "Loeschen"}
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] px-4 py-3 text-[11px] font-semibold"
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
            disabled={!title.trim()}
            className="rounded-[8px] px-4 py-3 text-[11px] font-semibold text-white disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 10px 20px ${color}30`,
            }}
          >
            {isEditing ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

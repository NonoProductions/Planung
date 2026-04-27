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

  return (
    <motion.div
      ref={formRef}
      data-calendar-form
      className="absolute z-50 flex flex-col overflow-hidden"
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width: 380,
        maxWidth: "calc(100% - 32px)",
        maxHeight: "min(720px, calc(100dvh - 40px))",
        borderRadius: 18,
        border: "1.5px solid rgba(224, 215, 205, 0.95)",
        background: "linear-gradient(180deg, #fffefb 0%, #faf6f0 100%)",
        boxShadow:
          "0 4px 6px rgba(0,0,0,0.02), 0 22px 50px rgba(82, 67, 48, 0.2), 0 0 0 0.5px rgba(224,215,205,0.5)",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      {/* Color accent strip */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          flexShrink: 0,
          borderRadius: "18px 18px 0 0",
        }}
      />

      {/* Header */}
      <div
        className="px-6 pt-6 pb-5"
        style={{
          borderBottom: "1px solid rgba(232, 223, 213, 0.85)",
          background: `linear-gradient(180deg, ${color}0d 0%, rgba(255,254,251,0) 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              {isEditing ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </p>
            <h3
              className="mt-2 break-words text-[20px] font-bold leading-[1.1] tracking-[-0.04em]"
              style={{ color: title.trim() ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {title.trim() || "Kalendereintrag"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[rgba(225,215,202,0.95)]"
            style={{
              backgroundColor: "rgba(237, 230, 222, 0.85)",
              color: "var(--text-muted)",
            }}
          >
            <X size={13} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "rgba(238, 231, 222, 0.88)",
              color: "var(--text-secondary)",
            }}
          >
            <CalendarDays size={10} />
            {formatDateLabel(selectedDate)}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "rgba(238, 231, 222, 0.88)",
              color: "var(--text-secondary)",
            }}
          >
            <Clock3 size={10} />
            {startTime} – {endTime}
          </span>
          <span
            className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: `${color}18`,
              color,
            }}
          >
            {durationLabel}
          </span>
          {selectedCategory ? (
            <span
              className="inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
              style={{
                backgroundColor: "rgba(238, 231, 222, 0.88)",
                color: selectedCategory.color,
              }}
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: selectedCategory.color }}
              />
              {selectedCategory.name}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 space-y-3.5 overflow-y-auto px-5 py-5">
        {/* Title + Note */}
        <section
          className="space-y-4 rounded-[14px] px-5 py-5"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(232, 224, 215, 0.9)",
          }}
        >
          <div className="space-y-2.5">
            <label
              className="block text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
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
              className="event-form-input w-full rounded-[9px] px-4 py-3 text-[14px]"
              style={{
                backgroundColor: "rgba(249, 244, 239, 0.88)",
                border: "1px solid rgba(225, 218, 210, 0.88)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="space-y-2.5">
            <label
              className="block text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              Notiz
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Optionaler Kontext"
              rows={3}
              className="event-form-input w-full resize-none rounded-[9px] px-4 py-3 text-[13px] leading-relaxed"
              style={{
                backgroundColor: "rgba(249, 244, 239, 0.88)",
                border: "1px solid rgba(225, 218, 210, 0.88)",
                color: "var(--text-secondary)",
              }}
            />
          </div>
        </section>

        {/* Time */}
        <section
          className="rounded-[14px] px-5 py-5"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(232, 224, 215, 0.9)",
          }}
        >
          <p
            className="mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Zeit
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <div
              className="rounded-[9px] px-3 py-3"
              style={{
                backgroundColor: "rgba(249, 244, 239, 0.88)",
                border: "1px solid rgba(225, 218, 210, 0.88)",
              }}
            >
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Start
              </p>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-1.5 w-full bg-transparent text-[13px] font-semibold outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            <div
              className="rounded-[9px] px-3 py-3"
              style={{
                backgroundColor: "rgba(249, 244, 239, 0.88)",
                border: "1px solid rgba(225, 218, 210, 0.88)",
              }}
            >
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Ende
              </p>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-1.5 w-full bg-transparent text-[13px] font-semibold outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            <div
              className="rounded-[9px] px-3 py-3"
              style={{
                backgroundColor: `${color}12`,
                border: `1px solid ${color}30`,
              }}
            >
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: `${color}bb` }}
              >
                Dauer
              </p>
              <p
                className="mt-1.5 text-[13px] font-semibold"
                style={{ color }}
              >
                {durationLabel}
              </p>
            </div>
          </div>
        </section>

        {/* Calendar + Color */}
        <div className="grid grid-cols-2 gap-3">
          <section
            className="rounded-[14px] px-5 py-5"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(232, 224, 215, 0.9)",
            }}
          >
            <label
              className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              Kalender
            </label>
            <div
              className="relative flex items-center gap-2 rounded-[9px] px-3 py-2.5"
              style={{
                backgroundColor: "rgba(249, 244, 239, 0.88)",
                border: "1px solid rgba(225, 218, 210, 0.88)",
              }}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: selectedCategory?.color || "rgba(178, 170, 161, 0.55)",
                }}
              />
              <select
                value={calendarCategoryId}
                onChange={(event) => setCalendarCategoryId(event.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent pr-4 text-[11px] outline-none"
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
                size={11}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          </section>

          <section
            className="rounded-[14px] px-5 py-5"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(232, 224, 215, 0.9)",
            }}
          >
            <label
              className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              Farbe
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_COLORS.map((eventColor) => (
                <button
                  key={eventColor}
                  type="button"
                  onClick={() => setColor(eventColor)}
                  className="relative flex h-8 w-full items-center justify-center rounded-[6px] transition-transform hover:scale-105"
                  style={{
                    backgroundColor: eventColor,
                    boxShadow:
                      color === eventColor
                        ? `0 0 0 2px white, 0 0 0 3.5px ${eventColor}`
                        : `0 2px 5px ${eventColor}30`,
                  }}
                >
                  {color === eventColor && (
                    <Check size={9} color="white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Recurring */}
        <section
          className="rounded-[14px] px-5 py-5"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${showRecurring ? "rgba(141, 124, 246, 0.28)" : "rgba(232, 224, 215, 0.9)"}`,
            transition: "border-color 180ms ease",
          }}
        >
          <button
            type="button"
            onClick={() => setShowRecurring((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px]"
                style={{
                  backgroundColor: showRecurring
                    ? "var(--accent-primary-light)"
                    : "rgba(242, 237, 230, 0.9)",
                  color: showRecurring ? "var(--accent-primary)" : "var(--text-muted)",
                  transition: "all 180ms ease",
                }}
              >
                <RefreshCw size={12} />
              </span>
              <div>
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Wiederholung
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {showRecurring ? frequencyLabel[frequency] : "Nur einmalig"}
                </p>
              </div>
            </div>
            <span
              className="rounded-[6px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                backgroundColor: showRecurring
                  ? "rgba(141, 124, 246, 0.12)"
                  : "rgba(242, 237, 230, 0.9)",
                color: showRecurring ? "var(--accent-primary)" : "var(--text-muted)",
                transition: "all 180ms ease",
              }}
            >
              {showRecurring ? "An" : "Aus"}
            </span>
          </button>

          {showRecurring && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["none", "daily", "weekly", "monthly"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFrequency(value)}
                    className="rounded-[8px] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                    style={{
                      backgroundColor:
                        frequency === value
                          ? "var(--accent-primary)"
                          : "rgba(242, 237, 230, 0.9)",
                      color: frequency === value ? "#ffffff" : "var(--text-muted)",
                    }}
                  >
                    {frequencyLabel[value]}
                  </button>
                ))}
              </div>

              {frequency !== "none" && (
                <div className="flex items-center gap-2.5">
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
                    className="w-14 rounded-[8px] px-3 py-2 text-center text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(249, 244, 239, 0.88)",
                      border: "1px solid rgba(225, 218, 210, 0.88)",
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
                <div className="grid grid-cols-7 gap-1">
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDayOfWeek(index)}
                      className="rounded-[6px] py-2 text-[10px] font-semibold transition-colors"
                      style={{
                        backgroundColor: daysOfWeek.includes(index)
                          ? "var(--accent-primary)"
                          : "rgba(242, 237, 230, 0.9)",
                        color: daysOfWeek.includes(index) ? "#ffffff" : "var(--text-muted)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {frequency !== "none" && (
                <div className="flex items-center gap-2.5">
                  <span className="shrink-0 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    Endet
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="flex-1 rounded-[8px] px-3.5 py-2 text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(249, 244, 239, 0.88)",
                      border: "1px solid rgba(225, 218, 210, 0.88)",
                      color: "var(--text-secondary)",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div
        className="space-y-3 px-5 py-5"
        style={{
          borderTop: "1px solid rgba(232, 223, 213, 0.85)",
          background: "linear-gradient(180deg, rgba(255,254,251,0) 0%, rgba(250,246,240,0.6) 100%)",
        }}
      >
        {isEditing && onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] px-4 py-2.5 text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: confirmDelete
                ? "var(--accent-danger-light)"
                : "rgba(249, 244, 239, 0.9)",
              color: confirmDelete ? "var(--accent-danger)" : "var(--text-muted)",
              border: `1px solid ${confirmDelete ? "rgba(224, 111, 111, 0.3)" : "rgba(228, 220, 211, 0.9)"}`,
            }}
          >
            <Trash2 size={11} />
            {confirmDelete ? "Bestätigen?" : "Löschen"}
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[9px] px-4 py-3 text-[12px] font-semibold transition-colors"
            style={{
              backgroundColor: "rgba(242, 237, 230, 0.92)",
              color: "var(--text-secondary)",
              border: "1px solid rgba(225, 218, 210, 0.88)",
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="rounded-[9px] px-4 py-3 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 8px 20px ${color}30`,
            }}
          >
            {isEditing ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

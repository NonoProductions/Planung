"use client";

/**
 * WeekCalendarView — shows 7 day columns with a shared time grid.
 * Events appear as colored blocks; clicking an empty slot opens EventForm
 * to create an event on that specific day.
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format, addDays, parseISO, isSameDay, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { useTaskStore } from "@/stores/taskStore";
import TimeBlock from "@/components/calendar/TimeBlock";
import CurrentTimeLine from "@/components/calendar/CurrentTimeLine";
import EventForm from "@/components/calendar/EventForm";
import type { CalendarEvent } from "@/types";
import { toLocalDateString } from "@/lib/date";

export const START_HOUR = 6;
export const END_HOUR = 22;
export const HOUR_HEIGHT = 64; // slightly smaller in week view

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i
);

interface FormState {
  mode: "create" | "edit";
  event?: CalendarEvent;
  defaultStart?: string;
  defaultEnd?: string;
  dayDate: string; // YYYY-MM-DD for which day to create on
  top: number;
  left: number;
}

interface Props {
  /** ISO date string for the Monday of the week to show */
  weekStart: string;
  /** Which calendar category IDs are visible (empty = all) */
  visibleCalendarIds: string[];
}

export default function WeekCalendarView({
  weekStart,
  visibleCalendarIds,
}: Props) {
  const events = useTaskStore((s) => s.events);
  const tasks = useTaskStore((s) => s.tasks);
  const calendarCategories = useTaskStore((s) => s.calendarCategories);
  const fetchEventsForWeek = useTaskStore((s) => s.fetchEventsForWeek);
  const addEvent = useTaskStore((s) => s.addEvent);
  const updateEvent = useTaskStore((s) => s.updateEvent);
  const deleteEvent = useTaskStore((s) => s.deleteEvent);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState<FormState | null>(null);

  // The 7 days of this week
  const weekDays = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  // Fetch events for the full week
  useEffect(() => {
    fetchEventsForWeek(weekStart);
  }, [weekStart, fetchEventsForWeek]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - START_HOUR - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  // Filter events by visible calendars
  const filteredEvents = useMemo(() => {
    if (visibleCalendarIds.length === 0) return events;
    return events.filter(
      (e) =>
        !e.calendarCategoryId ||
        visibleCalendarIds.includes(e.calendarCategoryId)
    );
  }, [events, visibleCalendarIds]);

  // Events grouped by day
  const eventsByDay = useMemo(() => {
    return weekDays.map((day) =>
      filteredEvents.filter((e) => isSameDay(parseISO(e.startTime), day))
    );
  }, [filteredEvents, weekDays]);

  // Timeboxed tasks by day
  const tasksByDay = useMemo(() => {
    return weekDays.map((day) =>
      tasks.filter(
        (t) =>
          t.scheduledStart &&
          t.scheduledEnd &&
          isSameDay(parseISO(t.scheduledStart), day)
      )
    );
  }, [tasks, weekDays]);

  const yToTime = useCallback((y: number): string => {
    const totalMinutes = Math.round((y / HOUR_HEIGHT) * 60);
    const snapped = Math.round(totalMinutes / 15) * 15;
    const hour = START_HOUR + Math.floor(snapped / 60);
    const minute = snapped % 60;
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }, []);

  const handleColumnClick = useCallback(
    (e: React.MouseEvent, dayDate: string, colIndex: number) => {
      if ((e.target as HTMLElement).closest("[data-timeblock]")) return;
      if (formState) {
        setFormState(null);
        return;
      }

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
      const x = e.clientX - rect.left;

      // Ignore clicks in the time-label column (first 44px)
      if (x < 44) return;

      const startTime = yToTime(y);
      const startParts = startTime.split(":");
      const endHour = Math.min(parseInt(startParts[0]) + 1, END_HOUR);
      const endTime = `${endHour.toString().padStart(2, "0")}:${startParts[1]}`;

      // Position form near click, capped within view
      const formTop = Math.min(y, HOURS.length * HOUR_HEIGHT - 360);
      // Estimate left offset based on column index
      const colWidth = (grid.clientWidth - 44) / 7;
      const formLeft = Math.min(44 + colIndex * colWidth, grid.clientWidth - 290);

      setFormState({
        mode: "create",
        defaultStart: startTime,
        defaultEnd: endTime,
        dayDate,
        top: Math.max(0, formTop),
        left: Math.max(44, formLeft),
      });
    },
    [formState, yToTime]
  );

  const handleEventClick = useCallback(
    (event: CalendarEvent, e: React.MouseEvent) => {
      e.stopPropagation();

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
      const x = e.clientX - rect.left;
      const formTop = Math.min(y, HOURS.length * HOUR_HEIGHT - 360);
      const formLeft = Math.min(x - 20, grid.clientWidth - 290);

      setFormState({
        mode: "edit",
        event,
        dayDate: event.startTime.split("T")[0],
        top: Math.max(0, formTop),
        left: Math.max(44, formLeft),
      });
    },
    []
  );

  const handleSaveEvent = useCallback(
    async (data: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      color: string;
      isRecurring: boolean;
      recurringRule?: import("@/types").RecurringRule | null;
      calendarCategoryId?: string;
    }) => {
      if (formState?.mode === "edit" && formState.event) {
        await updateEvent(formState.event.id, data);
      } else {
        await addEvent(data);
      }
      setFormState(null);
    },
    [formState, addEvent, updateEvent]
  );

  const handleDeleteEvent = useCallback(async () => {
    if (formState?.mode === "edit" && formState.event) {
      await deleteEvent(formState.event.id);
    }
    setFormState(null);
  }, [formState, deleteEvent]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Sticky day header row */}
      <div
        className="sticky top-0 z-20 flex"
        style={{
          backgroundColor: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        {/* Time label spacer */}
        <div className="w-11 shrink-0" />
        {weekDays.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className="flex flex-1 flex-col items-center py-2"
              style={{ borderLeft: "1px solid var(--border-subtle)" }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: today ? "var(--accent-primary)" : "var(--text-muted)" }}
              >
                {format(day, "EEE", { locale: de })}
              </span>
              <span
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold"
                style={
                  today
                    ? { backgroundColor: "var(--accent-primary)", color: "white" }
                    : { color: "var(--text-primary)" }
                }
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        ref={gridRef}
        className="relative flex"
        style={{ height: HOURS.length * HOUR_HEIGHT }}
      >
        {/* Hour labels column */}
        <div className="relative w-11 shrink-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            >
              <span
                className="pr-2 text-right text-[9px] font-medium tabular-nums w-full"
                style={{ color: "var(--text-muted)", opacity: 0.7, lineHeight: "1" }}
              >
                {`${hour.toString().padStart(2, "0")}:00`}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, colIdx) => {
          const dayStr = toLocalDateString(day);
          const dayEvents = eventsByDay[colIdx];
          const dayTasks = tasksByDay[colIdx];
          const today = isToday(day);

          return (
            <div
              key={dayStr}
              className="relative flex-1"
              style={{
                borderLeft: "1px solid var(--border-subtle)",
                backgroundColor: today
                  ? "color-mix(in srgb, var(--accent-primary) 2%, transparent)"
                  : "transparent",
              }}
              onClick={(e) => handleColumnClick(e, dayStr, colIdx)}
            >
              {/* Horizontal hour lines */}
              {HOURS.map((hour) => (
                <div key={hour}>
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: (hour - START_HOUR) * HOUR_HEIGHT,
                      borderTop: "1px solid var(--border-color)",
                      opacity: 0.5,
                    }}
                  />
                  {/* Half-hour dotted line */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      borderTop: "1px dashed var(--border-subtle)",
                      opacity: 0.4,
                    }}
                  />
                </div>
              ))}

              {/* Calendar events */}
              {dayEvents.map((event) => (
                <div key={event.id} data-timeblock>
                  <TimeBlock
                    id={event.id}
                    title={event.title}
                    startTime={event.startTime}
                    endTime={event.endTime}
                    color={
                      event.color ||
                      calendarCategories.find(
                        (c) => c.id === event.calendarCategoryId
                      )?.color
                    }
                    isEvent={true}
                    startHour={START_HOUR}
                    hourHeight={HOUR_HEIGHT}
                    onClick={(e) => handleEventClick(event, e)}
                  />
                </div>
              ))}

              {/* Timeboxed tasks */}
              {dayTasks.map((task) => (
                <div key={task.id} data-timeblock>
                  <TimeBlock
                    id={task.id}
                    title={task.title}
                    startTime={task.scheduledStart!}
                    endTime={task.scheduledEnd!}
                    color={task.channel?.color}
                    isEvent={false}
                    startHour={START_HOUR}
                    hourHeight={HOUR_HEIGHT}
                  />
                </div>
              ))}

              {/* Current time line (only on today's column) */}
              {today && (
                <CurrentTimeLine
                  startHour={START_HOUR}
                  hourHeight={HOUR_HEIGHT}
                />
              )}
            </div>
          );
        })}

        {/* Event form overlay — rendered inside the grid for absolute positioning */}
        {formState && (
          <EventForm
            event={formState.event}
            defaultStart={formState.defaultStart}
            defaultEnd={formState.defaultEnd}
            selectedDate={formState.dayDate}
            calendarCategories={calendarCategories}
            onSave={handleSaveEvent}
            onDelete={formState.mode === "edit" ? handleDeleteEvent : undefined}
            onClose={() => setFormState(null)}
            position={{ top: formState.top, left: formState.left }}
          />
        )}
      </div>
    </div>
  );
}

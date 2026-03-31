"use client";

import { useMemo, useRef, useEffect, useState, useCallback, startTransition } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { PanelsTopLeft, Plus, Search, X } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import TimeBlock from "@/components/calendar/TimeBlock";
import CurrentTimeLine from "@/components/calendar/CurrentTimeLine";
import EventForm from "@/components/calendar/EventForm";
import TaskScheduleForm from "@/components/calendar/TaskScheduleForm";
import type { CalendarEvent, Task } from "@/types";

export const START_HOUR = 6;
export const END_HOUR = 22;
export const HOUR_HEIGHT = 72;

const GRID_GUTTER = 62;
const FORM_MARGIN = 12;
const EVENT_FORM_WIDTH = 360;
const EVENT_FORM_HEIGHT = 720;
const TASK_FORM_WIDTH = 336;
const TASK_FORM_HEIGHT = 560;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => START_HOUR + index
);

interface FormState {
  kind: "event" | "task";
  mode?: "create" | "edit";
  event?: CalendarEvent;
  task?: Task;
  defaultStart?: string;
  defaultEnd?: string;
  top: number;
  left: number;
}

export default function CalendarView() {
  const selectedDate = useUIStore((state) => state.selectedDate);
  const calendarPlanningTaskId = useUIStore((state) => state.calendarPlanningTaskId);
  const setCalendarPlanningTaskId = useUIStore((state) => state.setCalendarPlanningTaskId);
  const setCalendarVisible = useUIStore((state) => state.setCalendarVisible);
  const events = useTaskStore((state) => state.events);
  const tasks = useTaskStore((state) => state.tasks);
  const calendarCategories = useTaskStore((state) => state.calendarCategories);
  const fetchEvents = useTaskStore((state) => state.fetchEvents);
  const fetchCalendarCategories = useTaskStore((state) => state.fetchCalendarCategories);
  const addEvent = useTaskStore((state) => state.addEvent);
  const updateEvent = useTaskStore((state) => state.updateEvent);
  const deleteEvent = useTaskStore((state) => state.deleteEvent);
  const updateTask = useTaskStore((state) => state.updateTask);

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState<FormState | null>(null);
  const selectedDateObj = parseISO(selectedDate);

  const clampFormPosition = useCallback((
    top: number,
    left: number,
    width: number,
    height = 320
  ) => {
    const grid = gridRef.current;
    if (!grid) {
      return { top, left };
    }

    const maxLeft = Math.max(FORM_MARGIN, grid.clientWidth - width - FORM_MARGIN);
    const maxTop = Math.max(FORM_MARGIN, HOURS.length * HOUR_HEIGHT - height - FORM_MARGIN);

    return {
      top: Math.max(FORM_MARGIN, Math.min(top, maxTop)),
      left: Math.max(FORM_MARGIN, Math.min(left, maxLeft)),
    };
  }, []);

  const yToTime = useCallback((y: number): string => {
    const totalMinutes = Math.round((y / HOUR_HEIGHT) * 60);
    const snapped = Math.round(totalMinutes / 15) * 15;
    const hour = START_HOUR + Math.floor(snapped / 60);
    const minute = snapped % 60;

    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const getTimeRangeFromClientY = useCallback(
    (clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return null;

      const rect = grid.getBoundingClientRect();
      const y = clientY - rect.top + (scrollRef.current?.scrollTop || 0);
      if (y < 0 || y > HOURS.length * HOUR_HEIGHT) return null;

      const startTime = yToTime(y);
      const startDate = new Date(`${selectedDate}T${startTime}:00`);

      return {
        scheduledDate: selectedDate,
        startTime: startDate.toISOString(),
        endTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
      };
    },
    [selectedDate, yToTime]
  );

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: "calendar-dropzone",
    data: {
      getTimeRangeFromClientY,
    },
  });

  useEffect(() => {
    fetchEvents(selectedDate);
  }, [selectedDate, fetchEvents]);

  useEffect(() => {
    fetchCalendarCategories();
  }, [fetchCalendarCategories]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!calendarPlanningTaskId) return;

    const task = tasks.find((item) => item.id === calendarPlanningTaskId);
    if (!task?.scheduledStart || !task.scheduledEnd) return;
    if (!isSameDay(parseISO(task.scheduledStart), selectedDateObj)) return;

    const start = parseISO(task.scheduledStart);
    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const position = clampFormPosition(
      (startMinutes / 60) * HOUR_HEIGHT,
      GRID_GUTTER,
      TASK_FORM_WIDTH,
      TASK_FORM_HEIGHT
    );

    startTransition(() => {
      setFormState({
        kind: "task",
        task,
        top: position.top,
        left: position.left,
      });
      setCalendarPlanningTaskId(null);
    });
  }, [calendarPlanningTaskId, clampFormPosition, selectedDateObj, setCalendarPlanningTaskId, tasks]);

  const dayEvents = useMemo(
    () =>
      events.filter((event) =>
        isSameDay(parseISO(event.startTime), selectedDateObj)
      ),
    [events, selectedDateObj]
  );

  const timeboxedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.scheduledStart &&
          task.scheduledEnd &&
          isSameDay(parseISO(task.scheduledStart), selectedDateObj)
      ),
    [tasks, selectedDateObj]
  );

  const handleGridClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-timeblock]")) return;
      if ((event.target as HTMLElement).closest("[data-calendar-form]")) return;

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const y = event.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
      const x = event.clientX - rect.left;
      if (x < GRID_GUTTER) return;

      const startTime = yToTime(y);
      const [startHourString, startMinutes] = startTime.split(":");
      const endHour = Math.min(parseInt(startHourString, 10) + 1, END_HOUR);
      const endTime = `${endHour.toString().padStart(2, "0")}:${startMinutes}`;
      const position = clampFormPosition(y, x + 10, EVENT_FORM_WIDTH, EVENT_FORM_HEIGHT);

      setFormState({
        kind: "event",
        mode: "create",
        defaultStart: startTime,
        defaultEnd: endTime,
        top: position.top,
        left: position.left,
      });
    },
    [clampFormPosition, yToTime]
  );

  const handleEventClick = useCallback(
    (event: CalendarEvent, mouseEvent: React.MouseEvent) => {
      mouseEvent.stopPropagation();
      if (event.id.startsWith("demo-")) return;

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const y = mouseEvent.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
      const x = mouseEvent.clientX - rect.left;
      const position = clampFormPosition(y, x + 10, EVENT_FORM_WIDTH, EVENT_FORM_HEIGHT);

      setFormState({
        kind: "event",
        mode: "edit",
        event,
        top: position.top,
        left: position.left,
      });
    },
    [clampFormPosition]
  );

  const handleTaskClick = useCallback((task: Task, mouseEvent: React.MouseEvent) => {
    mouseEvent.stopPropagation();

    const grid = gridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const y = mouseEvent.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    const x = mouseEvent.clientX - rect.left;
    const position = clampFormPosition(y, x + 10, TASK_FORM_WIDTH, TASK_FORM_HEIGHT);

    setFormState({
      kind: "task",
      task,
      top: position.top,
      left: position.left,
    });
  }, [clampFormPosition]);

  const handleSaveEvent = useCallback(
    async (data: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      color: string;
      isRecurring?: boolean;
      recurringRule?: CalendarEvent["recurringRule"];
      calendarCategoryId?: string;
    }) => {
      if (formState?.kind === "event" && formState.mode === "edit" && formState.event) {
        await updateEvent(formState.event.id, data);
      } else {
        await addEvent(data);
      }

      setFormState(null);
    },
    [formState, addEvent, updateEvent]
  );

  const handleDeleteEvent = useCallback(async () => {
    if (formState?.kind === "event" && formState.mode === "edit" && formState.event) {
      await deleteEvent(formState.event.id);
    }

    setFormState(null);
  }, [formState, deleteEvent]);

  const handleCreateEvent = useCallback(() => {
    const now = new Date();
    const roundedMinutes = Math.round(now.getMinutes() / 15) * 15;
    const minuteCarry = roundedMinutes === 60 ? 1 : 0;
    const startHour = Math.min(now.getHours() + minuteCarry, END_HOUR - 1);
    const displayMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
    const endHour = Math.min(startHour + 1, END_HOUR);
    const position = clampFormPosition(
      (startHour - START_HOUR) * HOUR_HEIGHT,
      GRID_GUTTER,
      EVENT_FORM_WIDTH,
      EVENT_FORM_HEIGHT
    );

    setFormState({
      kind: "event",
      mode: "create",
      defaultStart: `${startHour
        .toString()
        .padStart(2, "0")}:${displayMinutes.toString().padStart(2, "0")}`,
      defaultEnd: `${endHour
        .toString()
        .padStart(2, "0")}:${displayMinutes.toString().padStart(2, "0")}`,
      top: position.top,
      left: position.left,
    });
  }, [clampFormPosition]);

  const handleSaveTaskSchedule = useCallback(
    async (data: {
      scheduledDate: string;
      scheduledStart: string;
      scheduledEnd: string;
      plannedTime: number;
    }) => {
      if (formState?.kind !== "task" || !formState.task) return;

      await updateTask(formState.task.id, {
        scheduledDate: data.scheduledDate,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        plannedTime: data.plannedTime,
        isBacklog: false,
        backlogBucket: undefined,
        backlogFolder: undefined,
      });

      setFormState(null);
    },
    [formState, updateTask]
  );

  const handleUnscheduleTask = useCallback(async () => {
    if (formState?.kind !== "task" || !formState.task) return;

    await updateTask(formState.task.id, {
      scheduledStart: undefined,
      scheduledEnd: undefined,
    });

    setFormState(null);
  }, [formState, updateTask]);

  return (
    <aside className="calendar-panel">
      <header className="calendar-toolbar">
        <div className="calendar-toolbar__meta">
          <span className="calendar-toolbar__eyebrow">Calendar</span>
          <span className="calendar-toolbar__title">
            {format(selectedDateObj, "EEEE, d. MMM", { locale: de })}
          </span>
        </div>

        <div className="calendar-toolbar__actions">
          <button type="button" className="calendar-toolbar__button">
            <PanelsTopLeft size={15} strokeWidth={1.9} />
            Calendars
          </button>

          <button
            type="button"
            onClick={() => setCalendarVisible(false)}
            className="calendar-toolbar__button calendar-toolbar__button--dismiss"
            aria-label="Kalender schliessen"
          >
            <X size={15} strokeWidth={2.1} />
          </button>
        </div>
      </header>

      <div className="calendar-day-header">
        <div className="calendar-day-header__grid">
          <div className="calendar-day-header__search">
            <button
              type="button"
              className="calendar-day-header__search-button"
              aria-label="Search calendars"
            >
              <Search size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="calendar-day-header__content">
            <span className="calendar-day-header__weekday">
              {format(selectedDateObj, "EEE", { locale: de }).toUpperCase()}
            </span>
            <span className="calendar-day-header__date">
              {format(selectedDateObj, "d")}
            </span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="calendar-scroll">
        <div
          ref={(node) => {
            gridRef.current = node;
            setDroppableRef(node);
          }}
          className={isOver ? "calendar-grid calendar-grid--drop" : "calendar-grid"}
          style={{
            height: HOURS.length * HOUR_HEIGHT,
          }}
          onClick={handleGridClick}
        >
          {HOURS.map((hour) => (
            <div key={hour}>
              <div
                className="calendar-hour-row"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="calendar-hour-label">
                  {format(new Date(2026, 0, 1, hour), "HH:mm")}
                </span>
                <div className="calendar-hour-line" />
              </div>
            </div>
          ))}

          <div className="calendar-event-lane">
            {dayEvents.map((event) => (
              <div key={event.id} data-timeblock>
                <TimeBlock
                  id={event.id}
                  title={event.title}
                  startTime={event.startTime}
                  endTime={event.endTime}
                  color={event.color}
                  isEvent={true}
                  startHour={START_HOUR}
                  hourHeight={HOUR_HEIGHT}
                  onClick={(mouseEvent) => handleEventClick(event, mouseEvent)}
                />
              </div>
            ))}

            {timeboxedTasks.map((task) => (
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
                  onClick={(mouseEvent) => handleTaskClick(task, mouseEvent)}
                />
              </div>
            ))}
          </div>

          <CurrentTimeLine startHour={START_HOUR} hourHeight={HOUR_HEIGHT} />

          {formState?.kind === "event" && (
            <EventForm
              key={formState.event?.id ?? "new-event"}
              event={formState.event}
              defaultStart={formState.defaultStart}
              defaultEnd={formState.defaultEnd}
              selectedDate={selectedDate}
              calendarCategories={calendarCategories}
              onSave={handleSaveEvent}
              onDelete={formState.mode === "edit" ? handleDeleteEvent : undefined}
              onClose={() => setFormState(null)}
              position={{ top: formState.top, left: formState.left }}
            />
          )}

          {formState?.kind === "task" && formState.task && (
            <TaskScheduleForm
              key={formState.task.id}
              task={formState.task}
              selectedDate={selectedDate}
              onSave={handleSaveTaskSchedule}
              onUnschedule={handleUnscheduleTask}
              onClose={() => setFormState(null)}
              position={{ top: formState.top, left: formState.left }}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCreateEvent}
        className="calendar-fab"
        aria-label="Create event"
      >
        <Plus size={18} strokeWidth={2.4} />
      </button>
    </aside>
  );
}

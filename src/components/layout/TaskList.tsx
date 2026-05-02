"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import TaskCard from "@/components/tasks/TaskCard";
import type { Task } from "@/types";
import { toLocalDateString } from "@/lib/date";

const QUICK_ADD_DURATIONS = ["8:00", "4:30"];
const DEFAULT_PROGRESS_WEIGHT_MINUTES = 30;

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}`;
}

function computeElapsedWithBreaks(workMinutes: number) {
  const fullPomodoros = Math.floor(workMinutes / 25);
  const remainingWork = workMinutes % 25;

  let elapsed = 0;
  for (let i = 0; i < fullPomodoros; i++) {
    elapsed += 25;
    const isLast = i === fullPomodoros - 1 && remainingWork === 0;
    if (!isLast) {
      const isFourthInCycle = (i + 1) % 4 === 0;
      elapsed += isFourthInCycle ? 25 : 5;
    }
  }
  return elapsed + remainingWork;
}

function formatFinishTime(now: Date, totalMinutes: number) {
  const elapsedTotal = computeElapsedWithBreaks(totalMinutes);
  const finish = new Date(now.getTime() + elapsedTotal * 60_000);
  const sameDay = toLocalDateString(finish) === toLocalDateString(now);
  return sameDay
    ? format(finish, "HH:mm")
    : format(finish, "EEE HH:mm", { locale: de });
}

function getTaskCompletionRatio(task: Task): number {
  if (task.status === "COMPLETED") return 1;

  // Use time-tracking ratio when both planned and actual minutes are present.
  // Capped at 1 so an over-tracked task can't push the day over 100%.
  if (
    typeof task.plannedTime === "number" &&
    task.plannedTime > 0 &&
    typeof task.actualTime === "number" &&
    task.actualTime > 0
  ) {
    return Math.min(task.actualTime / task.plannedTime, 1);
  }

  // Fall back to subtask completion.
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) return 0;

  const sum = subtasks.reduce((acc, sub) => acc + getTaskCompletionRatio(sub), 0);
  return sum / subtasks.length;
}

function getTaskWeight(task: Task) {
  if (typeof task.plannedTime === "number" && task.plannedTime > 0) {
    return task.plannedTime;
  }
  return DEFAULT_PROGRESS_WEIGHT_MINUTES;
}

function getTaskRemainingMinutes(task: Task): number {
  if (task.status === "COMPLETED") return 0;
  if (typeof task.plannedTime !== "number" || task.plannedTime <= 0) return 0;
  const done = task.actualTime ?? 0;
  return Math.max(task.plannedTime - done, 0);
}

function getDayProgress(dayTasks: Task[]) {
  if (dayTasks.length === 0) return 0;

  let weightedDone = 0;
  let totalWeight = 0;
  for (const task of dayTasks) {
    const weight = getTaskWeight(task);
    weightedDone += weight * getTaskCompletionRatio(task);
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  const progress = Math.round((weightedDone / totalWeight) * 100);
  return Math.min(Math.max(progress, 0), 100);
}

export default function TaskList() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDate);
  const quickAddRequest = useUIStore((s) => s.quickAddRequest);
  const requestDayQuickAdd = useUIStore((s) => s.requestDayQuickAdd);
  const clearQuickAddRequest = useUIStore((s) => s.clearQuickAddRequest);
  const tasks = useTaskStore((s) => s.tasks);
  const channels = useTaskStore((s) => s.channels);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchChannels = useTaskStore((s) => s.fetchChannels);
  const addTask = useTaskStore((s) => s.addTask);

  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newPlannedTime, setNewPlannedTime] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchTasks();
  }, [selectedDate, fetchTasks]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateLayout = () => setIsCompactLayout(mediaQuery.matches);

    updateLayout();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateLayout);
      return () => mediaQuery.removeEventListener("change", updateLayout);
    }

    mediaQuery.addListener(updateLayout);
    return () => mediaQuery.removeListener(updateLayout);
  }, []);

  const showAddFormForDate =
    quickAddRequest?.mode === "day" ? quickAddRequest.value : null;

  useEffect(() => {
    if (showAddFormForDate) {
      addInputRef.current?.focus();
      addInputRef.current?.select();
    }
  }, [showAddFormForDate]);

  const baseDate = parseISO(selectedDate);

  const visibleDays = useMemo(
    () => Array.from({ length: isCompactLayout ? 1 : 2 }, (_, index) => addDays(baseDate, index)),
    [baseDate, isCompactLayout]
  );

  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const day of visibleDays) {
      grouped.set(toLocalDateString(day), []);
    }

    for (const task of tasks) {
      if (!task.scheduledDate) continue;
      if (!grouped.has(task.scheduledDate)) continue;
      grouped.get(task.scheduledDate)?.push(task);
    }

    for (const [date, dayTasks] of grouped.entries()) {
      grouped.set(
        date,
        dayTasks.sort((first, second) => first.position - second.position)
      );
    }

    return grouped;
  }, [tasks, visibleDays]);

  const handleAddTask = async (date: string) => {
    if (!newTitle.trim()) return;

    const dayTasks = tasksByDay.get(date) || [];

    await addTask({
      title: newTitle.trim(),
      scheduledDate: date,
      channelId: newChannelId || undefined,
      plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
      position: dayTasks.length,
    });

    setNewTitle("");
    setNewChannelId("");
    setNewPlannedTime("");
    clearQuickAddRequest();
  };

  const handleAddFormKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    date: string
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleAddTask(date);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearQuickAddRequest();
    }
  };

  return (
    <section className="planning-board">
      <div className="planning-toolbar">
        <div className="planning-toolbar__group planning-toolbar__group--nav">
          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateString(subDays(baseDate, 1)))}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Vorheriger Tag"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateString(new Date()))}
            className="planning-toolbar__button"
          >
            <CalendarDays size={15} strokeWidth={1.9} />
            Today
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateString(addDays(baseDate, 1)))}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Naechster Tag"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>

      </div>

      <div className="planning-columns">
        <div className="planning-columns__grid">
          {visibleDays.map((day, index) => {
            const dayDate = toLocalDateString(day);
            const dayTasks = tasksByDay.get(dayDate) || [];
            const dayRemainingTotal = dayTasks.reduce(
              (sum, task) => sum + getTaskRemainingMinutes(task),
              0
            );
            const dayProgress = getDayProgress(dayTasks);
            const isToday = dayDate === toLocalDateString(now);

            return (
              <section
                key={dayDate}
                className="planning-column"
                style={{ borderRight: index === visibleDays.length - 1 ? "0" : "1px solid #f0ebe5" }}
              >
                <div className="planning-column__inner">
                  <div className="planning-column__heading">
                    <button type="button" onClick={() => setSelectedDate(dayDate)} className="planning-column__button">
                      <h2 className="planning-column__title">
                        {format(day, "EEEE", { locale: de })}
                      </h2>
                      <p className="planning-column__date">
                        {format(day, "d. MMMM", { locale: de })}
                      </p>
                    </button>

                    <div className="planning-progress">
                      <div
                        className="planning-progress__fill"
                        style={{ width: `${dayProgress}%` }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => requestDayQuickAdd(dayDate)}
                      className="planning-quick-add"
                    >
                      <span className="planning-quick-add__label">
                        <Plus size={16} strokeWidth={2} />
                        Add task
                      </span>
                      <span className="planning-card__duration">
                        {dayRemainingTotal > 0
                          ? formatMinutes(dayRemainingTotal)
                          : QUICK_ADD_DURATIONS[index % QUICK_ADD_DURATIONS.length] || "0:30"}
                        {isToday && dayRemainingTotal > 0 && (
                          <span
                            style={{
                              marginLeft: "6px",
                              color: "var(--text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            → {formatFinishTime(now, dayRemainingTotal)}
                          </span>
                        )}
                      </span>
                    </button>

                    {showAddFormForDate === dayDate && (
                      <div className="planning-add-form">
                        <input
                          ref={addInputRef}
                          type="text"
                          value={newTitle}
                          onChange={(event) => setNewTitle(event.target.value)}
                          onKeyDown={(event) => handleAddFormKeyDown(event, dayDate)}
                          placeholder="Task title"
                          className="planning-add-form__input"
                          style={{
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                            backgroundColor: "#fbfaf8",
                          }}
                        />
                        <div className="planning-add-form__controls">
                          <select
                            value={newChannelId}
                            onChange={(event) => setNewChannelId(event.target.value)}
                            onKeyDown={(event) => handleAddFormKeyDown(event, dayDate)}
                            className="planning-add-form__select"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                              backgroundColor: "#fbfaf8",
                            }}
                          >
                            <option value="">No channel</option>
                            {channels.map((channel) => (
                              <option key={channel.id} value={channel.id}>
                                #{channel.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            value={newPlannedTime}
                            onChange={(event) => setNewPlannedTime(event.target.value)}
                            onKeyDown={(event) => handleAddFormKeyDown(event, dayDate)}
                            placeholder="Min"
                            className="planning-add-form__minutes"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                              backgroundColor: "#fbfaf8",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTask(dayDate)}
                            className="planning-add-form__save"
                            style={{ backgroundColor: "#7f766d" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="planning-cards">
                      {dayTasks.length > 0 ? (
                        <div className="planning-cards__stack">
                          <SortableContext
                            items={dayTasks.map((task) => task.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {dayTasks.map((task) => (
                              <TaskCard key={task.id} task={task} />
                            ))}
                          </SortableContext>
                        </div>
                      ) : (
                        <div
                          className="planning-cards__stack"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Keine in Supabase gespeicherten Tasks
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

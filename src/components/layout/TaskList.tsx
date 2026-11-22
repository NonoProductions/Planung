"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { de } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoonStar,
  Plus,
} from "lucide-react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { dayListId } from "@/lib/dayDrop";
import { useDayDropTarget } from "@/components/dnd/useDayDropTarget";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import TaskCard from "@/components/tasks/TaskCard";
import type { Task } from "@/types";
import { toLocalDateString } from "@/lib/date";
import { useDaySwipe } from "@/components/layout/useDaySwipe";
import { useDismissAddForm } from "@/hooks/useDismissAddForm";
import { useSlideIn, useTwoFingerSwipe } from "@/hooks/useTwoFingerSwipe";

const DEFAULT_PROGRESS_WEIGHT_MINUTES = 30;

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}`;
}

function getTaskProgressUnits(task: Task): { totalUnits: number; completedUnits: number } {
  const subtasks = task.subtasks || [];

  if (subtasks.length === 0) {
    return {
      totalUnits: 1,
      completedUnits: task.status === "COMPLETED" ? 1 : 0,
    };
  }

  return subtasks.reduce(
    (acc, subtask) => {
      const subtaskUnits = getTaskProgressUnits(subtask);
      return {
        totalUnits: acc.totalUnits + subtaskUnits.totalUnits,
        completedUnits: acc.completedUnits + subtaskUnits.completedUnits,
      };
    },
    {
      totalUnits: 1,
      completedUnits: task.status === "COMPLETED" ? 1 : 0,
    }
  );
}

function getTaskWeight(task: Task, totalUnits: number) {
  if (typeof task.plannedTime === "number" && task.plannedTime > 0) {
    return task.plannedTime;
  }

  return DEFAULT_PROGRESS_WEIGHT_MINUTES * Math.max(totalUnits, 1);
}

function getDayProgress(dayTasks: Task[]) {
  if (dayTasks.length === 0) return 0;

  const { completedWeight, totalWeight } = dayTasks.reduce(
    (acc, task) => {
      const { totalUnits, completedUnits } = getTaskProgressUnits(task);
      const weight = getTaskWeight(task, totalUnits);
      const progressRatio = totalUnits > 0 ? completedUnits / totalUnits : 0;

      return {
        completedWeight: acc.completedWeight + weight * progressRatio,
        totalWeight: acc.totalWeight + weight,
      };
    },
    { completedWeight: 0, totalWeight: 0 }
  );

  if (totalWeight === 0) return 0;

  const progress = Math.round((completedWeight / totalWeight) * 100);

  return Math.min(Math.max(progress, 0), 100);
}

/**
 * One day column. On desktop the whole column takes dropped tasks from the
 * other day and lights up while one hovers over it.
 */
function DayColumn({
  date,
  enabled,
  isLast,
  children,
}: {
  date: string;
  enabled: boolean;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isDropTarget } = useDayDropTarget(date, enabled);

  return (
    <section
      ref={setNodeRef}
      className={`planning-column${isDropTarget ? " planning-column--drop-target" : ""}`}
      style={{ borderRight: isLast ? "0" : "1px solid var(--line-soft)" }}
    >
      {children}
    </section>
  );
}

export default function TaskList() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDate);
  const openShutdownRitual = useUIStore((s) => s.openShutdownRitual);
  const quickAddRequest = useUIStore((s) => s.quickAddRequest);
  const requestDayQuickAdd = useUIStore((s) => s.requestDayQuickAdd);
  const clearQuickAddRequest = useUIStore((s) => s.clearQuickAddRequest);
  const tasks = useTaskStore((s) => s.tasks);
  const tasksFresh = useTaskStore((s) => s.tasksFresh);
  const channels = useTaskStore((s) => s.channels);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const fetchChannels = useTaskStore((s) => s.fetchChannels);
  const addTask = useTaskStore((s) => s.addTask);

  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newPlannedTime, setNewPlannedTime] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Loads all tasks at once, so switching days needs no new request.
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Coming back to the app (e.g. reopening it on the phone) quietly refreshes the
  // tasks in the background; the ones on screen stay until the new ones arrive.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchTasks();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [fetchTasks]);

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

  useDismissAddForm(Boolean(showAddFormForDate), clearQuickAddRequest);

  useEffect(() => {
    if (showAddFormForDate) {
      addInputRef.current?.focus();
      addInputRef.current?.select();
    }
  }, [showAddFormForDate]);

  const baseDate = parseISO(selectedDate);

  // On phones (one day visible) swipe left/right for the next/previous day.
  const swipeX = useDaySwipe({
    containerRef: columnsRef,
    enabled: isCompactLayout,
    date: selectedDate,
    onStep: (direction) =>
      setSelectedDate(toLocalDateString(addDays(parseISO(selectedDate), direction))),
  });

  // On the PC a two-finger swipe on the trackpad steps a day, and the days glide in.
  useTwoFingerSwipe(
    columnsRef,
    (direction) => setSelectedDate(toLocalDateString(addDays(parseISO(selectedDate), direction))),
    !isCompactLayout
  );
  useSlideIn(columnsRef, selectedDate, !isCompactLayout);

  // Phones show one day, but render yesterday and tomorrow beside it (off screen)
  // so swiping already reveals the neighbouring day.
  const visibleDays = useMemo(
    () =>
      isCompactLayout
        ? [subDays(baseDate, 1), baseDate, addDays(baseDate, 1)]
        : [baseDate, addDays(baseDate, 1)],
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
    const task = {
      title: newTitle.trim(),
      scheduledDate: date,
      channelId: newChannelId || undefined,
      plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
      position: dayTasks.length,
    };

    // Close the form at once; the card appears immediately and is saved in the background.
    setNewTitle("");
    setNewChannelId("");
    setNewPlannedTime("");
    clearQuickAddRequest();
    await addTask(task);
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
            aria-label="Nächster Tag"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="planning-toolbar__group">
          <button
            type="button"
            onClick={() => openShutdownRitual(selectedDate)}
            className="planning-toolbar__button"
          >
            <MoonStar size={15} strokeWidth={1.9} />
            Shutdown
          </button>
        </div>

      </div>

      <div ref={columnsRef} className="planning-columns">
        <motion.div
          className={`planning-columns__grid${isCompactLayout ? " planning-columns__grid--swipe" : ""}`}
          style={{ x: swipeX }}
        >
          {visibleDays.map((day, index) => {
            const dayDate = toLocalDateString(day);
            const dayTasks = tasksByDay.get(dayDate) || [];
            const dayPlannedTotal = dayTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0);
            const dayProgress = getDayProgress(dayTasks);

            return (
              <DayColumn
                key={dayDate}
                date={dayDate}
                enabled={!isCompactLayout}
                isLast={index === visibleDays.length - 1}
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
                      {dayPlannedTotal > 0 && (
                        <span className="planning-card__duration">
                          {formatMinutes(dayPlannedTotal)}
                        </span>
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                    {showAddFormForDate === dayDate && (
                      <motion.div
                        key="add-form"
                        className="planning-add-form-wrap"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                      >
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
                            backgroundColor: "var(--surface-subtle)",
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
                              backgroundColor: "var(--surface-subtle)",
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
                              backgroundColor: "var(--surface-subtle)",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTask(dayDate)}
                            className="planning-add-form__save"
                            style={{ backgroundColor: "var(--text-secondary)" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                      </motion.div>
                    )}
                    </AnimatePresence>

                    <div className="planning-cards">
                      {dayTasks.length > 0 ? (
                        <div className="planning-cards__stack">
                          <SortableContext
                            id={dayListId(dayDate)}
                            items={dayTasks.map((task) => task.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {dayTasks.map((task) => (
                              <TaskCard key={task.id} task={task} />
                            ))}
                          </SortableContext>
                        </div>
                      ) : !tasksFresh ? (
                        // Nothing cached for this day yet: placeholder cards until the tasks arrive.
                        <div className="planning-cards__stack" aria-busy="true" aria-label="Tasks werden geladen">
                          {[0, 1, 2].map((item) => (
                            <div key={item} className="planning-card planning-card--skeleton">
                              <span className="skeleton-line" style={{ width: `${[72, 54, 64][item]}%` }} />
                              <span className="skeleton-line skeleton-line--short" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="planning-cards__stack"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Keine Tasks
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </DayColumn>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

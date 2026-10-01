"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { addDays, format, isPast, isSameDay, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Plus } from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import TaskCard from "@/components/tasks/TaskCard";
import type { Task } from "@/types";
import { extractDateOnly, toLocalDateString } from "@/lib/date";

interface Props {
  weekStart: string;
}

export default function WeekGrid({ weekStart }: Props) {
  const tasks = useTaskStore((state) => state.tasks);
  const channels = useTaskStore((state) => state.channels);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchChannels = useTaskStore((state) => state.fetchChannels);
  const addTask = useTaskStore((state) => state.addTask);
  const setSelectedDate = useUIStore((state) => state.setSelectedDate);
  const quickAddRequest = useUIStore((state) => state.quickAddRequest);
  const requestDayQuickAdd = useUIStore((state) => state.requestDayQuickAdd);
  const clearQuickAddRequest = useUIStore((state) => state.clearQuickAddRequest);
  const router = useRouter();

  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newPlannedTime, setNewPlannedTime] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const todayRef = useRef<HTMLElement>(null);

  const addFormDate = quickAddRequest?.mode === "day" ? quickAddRequest.value : null;

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (addFormDate) addInputRef.current?.focus();
  }, [addFormDate]);

  useEffect(() => {
    fetchTasks(undefined);
    fetch(`/api/tasks?weekStart=${weekStart}`)
      .then((response) => response.json())
      .then((data) => {
        useTaskStore.setState((state) => {
          const existingIds = new Set(state.tasks.map((task) => task.id));
          const newTasks = (data as Record<string, unknown>[])
            .filter((task) => !existingIds.has(task.id as string))
            .map((task) => ({
              id: task.id as string,
              title: task.title as string,
              description: (task.description as string) || undefined,
              status: task.status as Task["status"],
              plannedTime: (task.plannedTime as number) || undefined,
              scheduledDate: extractDateOnly(task.scheduledDate as string | undefined),
              position: (task.position as number) ?? 0,
              channelId: (task.channelId as string) || undefined,
              channel: task.channel as Task["channel"],
              isRecurring: (task.isRecurring as boolean) ?? false,
              isBacklog: (task.isBacklog as boolean) ?? false,
              completedAt: (task.completedAt as string) || undefined,
            }));

          return { tasks: [...state.tasks, ...newTasks] };
        });
      })
      .catch(() => {});
  }, [weekStart, fetchTasks]);

  // Open the current week at today before the first paint, and keep today in place
  // while tasks load and the days above grow, until the user scrolls or taps.
  useLayoutEffect(() => {
    const today = todayRef.current;
    const days = today?.parentElement;
    if (!today || !days) return undefined;

    const isPhone = window.matchMedia("(max-width: 767px)").matches;
    let pinned = true;
    const pin = () => {
      if (!pinned) return;
      today.scrollIntoView({
        behavior: "instant",
        block: isPhone ? "start" : "nearest",
        inline: "nearest",
      });
    };
    const release = () => {
      pinned = false;
    };

    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(days);
    const timer = window.setTimeout(release, 2500);
    const userEvents = ["touchstart", "wheel", "mousedown", "keydown"] as const;
    userEvents.forEach((type) =>
      window.addEventListener(type, release, { capture: true, passive: true })
    );

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      userEvents.forEach((type) => window.removeEventListener(type, release, { capture: true }));
    };
  }, [weekStart]);

  const weekDays = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [weekStart]);

  function tasksForDay(day: Date): Task[] {
    return tasks
      .filter((task) => {
        if (!task.scheduledDate) return false;
        return isSameDay(parseISO(task.scheduledDate), day);
      })
      .sort((first, second) => first.position - second.position);
  }

  function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  function navigateToDay(day: Date) {
    setSelectedDate(toLocalDateString(day));
    router.push("/");
  }

  function resetAddForm() {
    setNewTitle("");
    setNewChannelId("");
    setNewPlannedTime("");
    clearQuickAddRequest();
  }

  async function handleAddTask(date: string, position: number) {
    if (!newTitle.trim()) return;

    await addTask({
      title: newTitle.trim(),
      scheduledDate: date,
      channelId: newChannelId || undefined,
      plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
      position,
    });

    resetAddForm();
  }

  function handleAddKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    date: string,
    position: number
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleAddTask(date, position);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetAddForm();
    }
  }

  return (
    <div className="week-days">
      {weekDays.map((day) => {
        const dayDate = toLocalDateString(day);
        const dayTasks = tasksForDay(day);
        const today = isToday(day);
        const past = !today && isPast(day);
        const completedCount = dayTasks.filter((task) => task.status === "COMPLETED").length;
        const totalPlanned = dayTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0);
        const completionPct = dayTasks.length > 0 ? (completedCount / dayTasks.length) * 100 : 0;

        const workloadColor =
          totalPlanned <= 360
            ? "var(--accent-success)"
            : totalPlanned <= 480
              ? "var(--accent-warning)"
              : "var(--accent-danger)";

        return (
          <section
            key={dayDate}
            ref={today ? todayRef : undefined}
            className={`week-day${past ? " week-day--past" : ""}`}
          >
            <button
              type="button"
              onClick={() => navigateToDay(day)}
              className="planning-column__button"
              title="Tag auf Home öffnen"
            >
              <h2
                className="week-day__title"
                style={today ? { color: "var(--accent-primary)" } : undefined}
              >
                {format(day, "EEEE", { locale: de })}
              </h2>
              <p className="week-day__date">{format(day, "d. MMMM", { locale: de })}</p>
            </button>

            <div className="planning-progress week-day__progress">
              <div
                className="planning-progress__fill"
                style={{ width: `${completionPct}%` }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (addFormDate === dayDate) {
                  resetAddForm();
                  return;
                }
                setNewTitle("");
                requestDayQuickAdd(dayDate);
              }}
              className="planning-quick-add week-day__add"
            >
              <span className="planning-quick-add__label">
                <Plus size={15} strokeWidth={2} />
                Aufgabe
              </span>
              {totalPlanned > 0 && (
                <span className="planning-card__duration" style={{ color: workloadColor }}>
                  {formatMinutes(totalPlanned)}
                </span>
              )}
            </button>

            {addFormDate === dayDate && (
              <div className="planning-add-form">
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  onKeyDown={(event) => handleAddKeyDown(event, dayDate, dayTasks.length)}
                  placeholder="Neue Aufgabe..."
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
                    onKeyDown={(event) => handleAddKeyDown(event, dayDate, dayTasks.length)}
                    className="planning-add-form__select"
                  >
                    <option value="">Kein Kanal</option>
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
                    onKeyDown={(event) => handleAddKeyDown(event, dayDate, dayTasks.length)}
                    placeholder="Min"
                    className="planning-add-form__minutes"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddTask(dayDate, dayTasks.length)}
                    disabled={!newTitle.trim()}
                    className="planning-add-form__save disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent-primary)" }}
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            )}

            <div className="week-day__cards">
              <SortableContext
                items={dayTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {dayTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </SortableContext>

              {dayTasks.length === 0 && (
                <p className="backlog-empty-copy">Keine Aufgaben</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

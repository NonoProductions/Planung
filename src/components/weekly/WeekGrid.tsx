"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task } from "@/types";
import { extractDateOnly, toLocalDateString } from "@/lib/date";

interface Props {
  weekStart: string;
}

export default function WeekGrid({ weekStart }: Props) {
  const { tasks, fetchTasks, toggleTaskStatus } = useTaskStore();
  const { setSelectedDate } = useUIStore();
  const router = useRouter();
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

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

  return (
    <div className="week-grid">
      {weekDays.map((day) => {
        const dayTasks = tasksForDay(day);
        const today = isToday(day);
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
          <div key={day.toISOString()} className="week-grid__day">
            <div
              className="week-grid__header"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <button
                onClick={() => navigateToDay(day)}
                className="week-grid__day-button"
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: today ? "var(--accent-primary)" : "var(--text-muted)" }}
                >
                  {format(day, "EEE", { locale: de })}
                </span>

                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-semibold"
                  style={
                    today
                      ? { backgroundColor: "var(--accent-primary)", color: "white" }
                      : { color: "var(--text-primary)" }
                  }
                >
                  {format(day, "d")}
                </span>
              </button>

              {totalPlanned > 0 && (
                <div
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium"
                  style={{
                    backgroundColor: `${workloadColor}18`,
                    color: workloadColor,
                  }}
                >
                  <Clock size={9} strokeWidth={2.2} />
                  {formatMinutes(totalPlanned)}
                </div>
              )}

              {dayTasks.length > 0 && (
                <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <motion.div
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.4 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: "var(--accent-success)" }}
                  />
                </div>
              )}
            </div>

            <div className="week-grid__body">
              <AnimatePresence mode="popLayout">
                {dayTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className="week-grid__task group"
                    style={{
                      backgroundColor:
                        hoveredTaskId === task.id ? "var(--bg-hover)" : "rgba(255, 255, 255, 0.78)",
                      borderColor:
                        hoveredTaskId === task.id
                          ? "rgba(214, 206, 197, 0.92)"
                          : "rgba(230, 223, 215, 0.68)",
                      boxShadow:
                        hoveredTaskId === task.id
                          ? "0 6px 18px rgba(89, 72, 48, 0.07)"
                          : "0 1px 0 rgba(89, 72, 48, 0.03)",
                    }}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    <button
                      onClick={() => toggleTaskStatus(task.id)}
                      className="mt-0.5 shrink-0 transition-all duration-150"
                      aria-label={
                        task.status === "COMPLETED"
                          ? "Als offen markieren"
                          : "Als erledigt markieren"
                      }
                    >
                      {task.status === "COMPLETED" ? (
                        <CheckCircle2
                          size={15}
                          strokeWidth={1.8}
                          style={{ color: "var(--accent-success)" }}
                        />
                      ) : (
                        <Circle
                          size={15}
                          strokeWidth={1.6}
                          style={{ color: "var(--text-muted)" }}
                        />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13px] font-medium leading-[1.45]"
                        style={{
                          color:
                            task.status === "COMPLETED"
                              ? "var(--text-muted)"
                              : "var(--text-primary)",
                          textDecoration: task.status === "COMPLETED" ? "line-through" : "none",
                        }}
                      >
                        {task.title}
                      </p>

                      {task.channel && (
                        <span
                          className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-medium"
                          style={{ color: task.channel.color }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: task.channel.color }}
                          />
                          {task.channel.name}
                        </span>
                      )}
                    </div>

                    {task.plannedTime && (
                      <span
                        className="shrink-0 pt-0.5 text-[10.5px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatMinutes(task.plannedTime)}
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {dayTasks.length === 0 && (
                <div className="week-grid__empty" style={{ color: "var(--text-muted)" }}>
                  Keine Aufgaben
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

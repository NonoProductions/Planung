"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Clock3,
  Crosshair,
  Edit3,
  Layers3,
  Plus,
  X,
} from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import { toLocalDateString } from "@/lib/date";

function formatPlannedTime(minutes?: number) {
  if (!minutes || minutes <= 0) return "Ohne Zeitschaetzung";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

export default function FocusModeModal() {
  const focusTaskId = useUIStore((state) => state.focusTaskId);
  const closeFocusMode = useUIStore((state) => state.closeFocusMode);
  const startEditingTask = useUIStore((state) => state.startEditingTask);
  const selectTask = useUIStore((state) => state.selectTask);
  const selectedDate = useUIStore((state) => state.selectedDate);

  const tasks = useTaskStore((state) => state.tasks);
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const channels = useTaskStore((state) => state.channels);
  const fetchChannels = useTaskStore((state) => state.fetchChannels);
  const addTask = useTaskStore((state) => state.addTask);
  const toggleTaskStatus = useTaskStore((state) => state.toggleTaskStatus);
  const toggleSubtaskStatus = useTaskStore((state) => state.toggleSubtaskStatus);

  const [newTaskDate, setNewTaskDate] = useState(selectedDate);
  const [newTitle, setNewTitle] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newPlannedTime, setNewPlannedTime] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const task = useMemo(() => {
    if (!focusTaskId) return null;

    return (
      tasks.find((item) => item.id === focusTaskId) ??
      backlogTasks.find((item) => item.id === focusTaskId) ??
      null
    );
  }, [backlogTasks, focusTaskId, tasks]);

  useEffect(() => {
    if (focusTaskId && !task) {
      closeFocusMode();
    }
  }, [closeFocusMode, focusTaskId, task]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    setNewTaskDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [newTaskDate]);

  if (!task) return null;

  const isCompleted = task.status === "COMPLETED";
  const subtasks = task.subtasks ?? [];
  const taskDateLabel = task.scheduledDate
    ? format(parseISO(task.scheduledDate), "EEEE, d. MMMM", { locale: de })
    : "Backlog";
  const baseDate = parseISO(selectedDate);
  const dayOptions = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(baseDate, index);
    const isoDate = toLocalDateString(day);
    const dayTasks = tasks.filter(
      (item) => item.scheduledDate === isoDate && !item.isBacklog
    );

    return {
      isoDate,
      weekdayLabel: format(day, "EEE", { locale: de }),
      dateLabel: format(day, "d. MMM", { locale: de }),
      totalPlannedMinutes: dayTasks.reduce(
        (sum, item) => sum + (item.plannedTime ?? 0),
        0
      ),
      taskCount: dayTasks.length,
    };
  });

  const handleCreateTask = async () => {
    if (!newTitle.trim() || isAddingTask) return;

    const dayTasks = tasks.filter(
      (item) => item.scheduledDate === newTaskDate && !item.isBacklog
    );

    setIsAddingTask(true);
    try {
      await addTask({
        title: newTitle.trim(),
        scheduledDate: newTaskDate,
        channelId: newChannelId || undefined,
        plannedTime: newPlannedTime ? parseInt(newPlannedTime, 10) : undefined,
        position: dayTasks.length,
      });

      setNewTitle("");
      setNewChannelId("");
      setNewPlannedTime("");
      inputRef.current?.focus();
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleAddKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleCreateTask();
    }
  };

  return (
    <AnimatePresence>
      {focusTaskId && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
          style={{
            backgroundColor: "rgba(18, 15, 13, 0.52)",
            backdropFilter: "blur(10px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeFocusMode();
            }
          }}
        >
          <motion.div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-[36px]"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background:
                "linear-gradient(180deg, rgba(18, 24, 38, 0.96), rgba(20, 28, 45, 0.98))",
              border: "1px solid rgba(144, 165, 223, 0.18)",
              boxShadow: "0 32px 96px rgba(0, 0, 0, 0.34)",
            }}
          >
            <div
              className="flex items-start gap-4 px-5 py-5 sm:px-7 sm:py-6"
              style={{ borderBottom: "1px solid rgba(144, 165, 223, 0.12)" }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(104, 180, 255, 0.22), rgba(141, 124, 246, 0.2))",
                  color: "#cfe0ff",
                }}
              >
                <Crosshair size={20} strokeWidth={1.9} />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: "rgba(204, 217, 243, 0.64)" }}
                >
                  Focus Mode
                </p>
                <h2
                  className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.06em]"
                  style={{ color: "#f7f9ff" }}
                >
                  {task.title}
                </h2>
                <p
                  className="mt-3 max-w-[62ch] text-[14px] leading-7"
                  style={{ color: "rgba(220, 229, 248, 0.76)" }}
                >
                  Eine ruhige Einzelansicht fuer genau die Aufgabe, die jetzt
                  Aufmerksamkeit bekommen soll.
                </p>
              </div>

              <button
                type="button"
                onClick={closeFocusMode}
                className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors"
                style={{ color: "rgba(220, 229, 248, 0.72)" }}
                aria-label="Focus Mode schliessen"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="grid max-h-[68vh] gap-5 overflow-y-auto px-5 py-5 lg:grid-cols-[1.08fr_0.92fr] sm:px-7 sm:py-6">
              <section
                className="rounded-[30px] border p-5 sm:p-6"
                style={{
                  borderColor: "rgba(144, 165, 223, 0.14)",
                  background:
                    "linear-gradient(180deg, rgba(30, 40, 63, 0.96), rgba(22, 31, 49, 0.96))",
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <InfoPill icon={<Clock3 size={13} strokeWidth={2} />} label={formatPlannedTime(task.plannedTime)} />
                  <InfoPill icon={<Layers3 size={13} strokeWidth={2} />} label={taskDateLabel} />
                  {task.channel && (
                    <InfoPill
                      icon={<span className="text-[12px] font-bold">#</span>}
                      label={task.channel.name}
                      accent={task.channel.color}
                    />
                  )}
                </div>

                <div className="mt-8">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: "rgba(204, 217, 243, 0.56)" }}
                  >
                    Jetzt im Fokus
                  </p>
                  <p
                    className="mt-4 text-[18px] leading-8"
                    style={{ color: "rgba(241, 245, 255, 0.92)" }}
                  >
                    {isCompleted
                      ? "Diese Aufgabe ist bereits abgeschlossen. Du kannst sie wieder oeffnen oder direkt zur naechsten wechseln."
                      : "Arbeite diese Aufgabe jetzt ohne visuelles Rauschen ab. Wenn sie abgeschlossen ist, markiere sie direkt hier."}
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      selectTask(task.id);
                      toggleTaskStatus(task.id);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-[14px] font-semibold"
                    style={{
                      backgroundColor: isCompleted
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(106, 194, 135, 0.18)",
                      color: "#f7f9ff",
                      border: `1px solid ${isCompleted ? "rgba(255,255,255,0.14)" : "rgba(106, 194, 135, 0.28)"}`,
                    }}
                  >
                    <Check size={15} strokeWidth={2.4} />
                    {isCompleted ? "Wieder oeffnen" : "Als erledigt markieren"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selectTask(task.id);
                      closeFocusMode();
                      startEditingTask(task.id);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-[14px] font-semibold"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.08)",
                      color: "rgba(241, 245, 255, 0.92)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Edit3 size={15} strokeWidth={2.2} />
                    Bearbeiten
                  </button>
                </div>
              </section>

              <section
                className="rounded-[30px] border p-5 sm:p-6"
                style={{
                  borderColor: "rgba(144, 165, 223, 0.14)",
                  background:
                    "linear-gradient(180deg, rgba(22, 31, 49, 0.96), rgba(18, 24, 38, 0.98))",
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "rgba(204, 217, 243, 0.56)" }}
                >
                  Teilaufgaben
                </p>

                <div className="mt-5 space-y-3">
                  {subtasks.length > 0 ? (
                    subtasks.map((subtask) => {
                      const subtaskDone = subtask.status === "COMPLETED";

                      return (
                        <button
                          key={subtask.id}
                          type="button"
                          onClick={() => toggleSubtaskStatus(task.id, subtask.id)}
                          className="flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-colors"
                          style={{
                            borderColor: "rgba(144, 165, 223, 0.14)",
                            backgroundColor: subtaskDone
                              ? "rgba(106, 194, 135, 0.14)"
                              : "rgba(255,255,255,0.06)",
                          }}
                        >
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                            style={{
                              borderColor: subtaskDone
                                ? "rgba(106, 194, 135, 0.86)"
                                : "rgba(204, 217, 243, 0.34)",
                              backgroundColor: subtaskDone
                                ? "rgba(106, 194, 135, 0.86)"
                                : "transparent",
                              color: "#0f1827",
                            }}
                          >
                            {subtaskDone && <Check size={12} strokeWidth={2.8} />}
                          </span>
                          <span
                            className="text-[14px] leading-6"
                            style={{
                              color: subtaskDone
                                ? "rgba(204, 217, 243, 0.66)"
                                : "rgba(241, 245, 255, 0.92)",
                              textDecoration: subtaskDone ? "line-through" : "none",
                            }}
                          >
                            {subtask.title}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div
                      className="rounded-[22px] border px-4 py-5 text-[14px] leading-7"
                      style={{
                        borderColor: "rgba(144, 165, 223, 0.14)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        color: "rgba(220, 229, 248, 0.72)",
                      }}
                    >
                      Keine Subtasks vorhanden. Wenn du diese Aufgabe weiter
                      aufteilen willst, kannst du sie ueber Bearbeiten direkt
                      feiner schneiden.
                    </div>
                  )}
                </div>

                <div
                  className="mt-6 rounded-[24px] border p-4"
                  style={{
                    borderColor: "rgba(144, 165, 223, 0.16)",
                    background:
                      "linear-gradient(180deg, rgba(26, 36, 56, 0.9), rgba(20, 30, 47, 0.94))",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} strokeWidth={2} color="rgba(211, 225, 255, 0.85)" />
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "rgba(204, 217, 243, 0.62)" }}
                    >
                      Task fuer jeden Tag hinzufuegen
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {dayOptions.map((day) => {
                      const isActive = day.isoDate === newTaskDate;
                      const plannedLabel = day.totalPlannedMinutes > 0
                        ? `${Math.floor(day.totalPlannedMinutes / 60)}:${(day.totalPlannedMinutes % 60).toString().padStart(2, "0")}`
                        : "0:00";

                      return (
                        <button
                          key={day.isoDate}
                          type="button"
                          onClick={() => setNewTaskDate(day.isoDate)}
                          className="rounded-[16px] border px-3 py-2 text-left transition-colors"
                          style={{
                            borderColor: isActive
                              ? "rgba(147, 182, 255, 0.5)"
                              : "rgba(144, 165, 223, 0.2)",
                            backgroundColor: isActive
                              ? "rgba(122, 158, 241, 0.22)"
                              : "rgba(255,255,255,0.04)",
                          }}
                        >
                          <p
                            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                            style={{
                              color: isActive
                                ? "rgba(241, 246, 255, 0.92)"
                                : "rgba(204, 217, 243, 0.72)",
                            }}
                          >
                            {day.weekdayLabel}
                          </p>
                          <p
                            className="mt-1 text-[13px] font-medium"
                            style={{
                              color: isActive
                                ? "rgba(247, 250, 255, 0.96)"
                                : "rgba(220, 229, 248, 0.86)",
                            }}
                          >
                            {day.dateLabel}
                          </p>
                          <p
                            className="mt-1 text-[11px]"
                            style={{ color: "rgba(204, 217, 243, 0.6)" }}
                          >
                            {day.taskCount} Tasks · {plannedLabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 space-y-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTitle}
                      onChange={(event) => setNewTitle(event.target.value)}
                      onKeyDown={handleAddKeyDown}
                      placeholder="Task title"
                      className="w-full rounded-[14px] border px-3 py-2 text-[14px]"
                      style={{
                        borderColor: "rgba(144, 165, 223, 0.24)",
                        color: "rgba(247, 250, 255, 0.96)",
                        backgroundColor: "rgba(8, 14, 25, 0.34)",
                      }}
                    />

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={newChannelId}
                        onChange={(event) => setNewChannelId(event.target.value)}
                        onKeyDown={handleAddKeyDown}
                        className="min-h-[40px] flex-1 rounded-[14px] border px-3 text-[13px]"
                        style={{
                          borderColor: "rgba(144, 165, 223, 0.24)",
                          color: "rgba(220, 229, 248, 0.92)",
                          backgroundColor: "rgba(8, 14, 25, 0.34)",
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
                        onKeyDown={handleAddKeyDown}
                        placeholder="Min"
                        className="min-h-[40px] w-full rounded-[14px] border px-3 text-[13px] sm:w-[88px]"
                        style={{
                          borderColor: "rgba(144, 165, 223, 0.24)",
                          color: "rgba(220, 229, 248, 0.92)",
                          backgroundColor: "rgba(8, 14, 25, 0.34)",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          void handleCreateTask();
                        }}
                        disabled={!newTitle.trim() || isAddingTask}
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[14px] border px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          borderColor: "rgba(115, 200, 154, 0.34)",
                          backgroundColor: "rgba(92, 183, 135, 0.2)",
                          color: "rgba(247, 250, 255, 0.96)",
                        }}
                      >
                        <Plus size={14} strokeWidth={2.4} />
                        {isAddingTask ? "Saving..." : "Add task"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoPill({
  icon,
  label,
  accent,
}: {
  icon: ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
      style={{
        backgroundColor: accent ? `${accent}22` : "rgba(255,255,255,0.1)",
        color: accent ?? "rgba(241, 245, 255, 0.86)",
        border: `1px solid ${accent ? `${accent}33` : "rgba(255,255,255,0.12)"}`,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

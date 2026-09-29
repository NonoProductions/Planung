"use client";

import { useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crosshair, Edit3, X } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";

function formatPlannedTime(minutes?: number) {
  if (!minutes || minutes <= 0) return "Ohne Zeitschätzung";

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

  const tasks = useTaskStore((state) => state.tasks);
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const toggleTaskStatus = useTaskStore((state) => state.toggleTaskStatus);
  const toggleSubtaskStatus = useTaskStore((state) => state.toggleSubtaskStatus);

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

  if (!task) return null;

  const isCompleted = task.status === "COMPLETED";
  const subtasks = task.subtasks ?? [];
  const taskDateLabel = task.scheduledDate
    ? format(parseISO(task.scheduledDate), "EEEE, d. MMMM", { locale: de })
    : "Backlog";

  return (
    <AnimatePresence>
      {focusTaskId && (
        <motion.div
          className="app-overlay z-[150]"
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
            className="ritual-modal ritual-modal--board flex w-full max-w-[920px] min-h-0 max-h-[calc(100dvh-32px)] flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="planning-toolbar ritual-modal__toolbar">
              <div className="flex min-w-0 items-center gap-2">
                <Crosshair size={16} strokeWidth={2} style={{ color: "var(--accent-primary)" }} />
                <span className="settings-toolbar__title truncate">Focus Mode</span>
                {isCompleted && (
                  <span className="workspace-badge workspace-badge--success">Erledigt</span>
                )}
              </div>
              <button
                type="button"
                onClick={closeFocusMode}
                className="planning-toolbar__button planning-toolbar__button--icon"
                aria-label="Focus Mode schließen"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="ritual-modal__columns">
              <section className="analytics-section">
                <h3 className="planning-column__title">{task.title}</h3>
                <p className="planning-column__date">{taskDateLabel}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="planning-card__duration">
                    {formatPlannedTime(task.plannedTime)}
                  </span>
                  {task.channel && (
                    <span
                      className="planning-card__duration"
                      style={{ color: task.channel.color }}
                    >
                      #{task.channel.name}
                    </span>
                  )}
                </div>

                <div className="analytics-section__body">
                  <p className="settings-row__description">
                    {isCompleted
                      ? "Diese Aufgabe ist bereits abgeschlossen. Du kannst sie wieder öffnen oder direkt zur nächsten wechseln."
                      : "Arbeite diese Aufgabe jetzt ohne visuelles Rauschen ab. Wenn sie abgeschlossen ist, markiere sie direkt hier."}
                  </p>

                  <div className="ritual-actions">
                    <button
                      type="button"
                      onClick={() => {
                        selectTask(task.id);
                        toggleTaskStatus(task.id);
                      }}
                      className={`workspace-button ${isCompleted ? "" : "workspace-button--primary"}`}
                    >
                      <Check size={15} strokeWidth={2.4} />
                      {isCompleted ? "Wieder öffnen" : "Als erledigt markieren"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        selectTask(task.id);
                        closeFocusMode();
                        startEditingTask(task.id);
                      }}
                      className="workspace-button"
                    >
                      <Edit3 size={15} strokeWidth={2.2} />
                      Bearbeiten
                    </button>
                  </div>
                </div>
              </section>

              <section className="analytics-section">
                <h3 className="planning-column__title">Teilaufgaben</h3>
                <p className="planning-column__date">
                  {subtasks.length > 0
                    ? `${subtasks.filter((subtask) => subtask.status === "COMPLETED").length} von ${subtasks.length} erledigt`
                    : "Keine Subtasks"}
                </p>

                <div className="analytics-section__body ritual-list">
                  {subtasks.length > 0 ? (
                    subtasks.map((subtask) => {
                      const subtaskDone = subtask.status === "COMPLETED";

                      return (
                        <button
                          key={subtask.id}
                          type="button"
                          onClick={() => toggleSubtaskStatus(task.id, subtask.id)}
                          className="ritual-row focus-subtask"
                        >
                          <span className={`focus-check ${subtaskDone ? "focus-check--done" : ""}`}>
                            {subtaskDone && <Check size={12} strokeWidth={2.8} />}
                          </span>
                          <span
                            className="settings-row__label min-w-0 flex-1"
                            style={
                              subtaskDone
                                ? { textDecoration: "line-through", color: "var(--text-secondary)" }
                                : undefined
                            }
                          >
                            {subtask.title}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="settings-row__description">
                      Wenn du diese Aufgabe weiter aufteilen willst, kannst du sie
                      über Bearbeiten direkt feiner schneiden.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

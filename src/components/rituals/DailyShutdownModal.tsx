"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { MoonStar, X } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export default function DailyShutdownModal() {
  const open = useUIStore((state) => state.shutdownRitualOpen);
  const selectedDate = useUIStore((state) => state.selectedDate);
  const shutdownRitualDate = useUIStore((state) => state.shutdownRitualDate);
  const closeShutdownRitual = useUIStore((state) => state.closeShutdownRitual);
  const completeShutdownRitual = useUIStore(
    (state) => state.completeShutdownRitual
  );
  const shutdownRitualCompletedDates = useUIStore(
    (state) => state.shutdownRitualCompletedDates
  );
  const dailyShutdownNotes = useUIStore((state) => state.dailyShutdownNotes);

  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const [reflectionDrafts, setReflectionDrafts] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!open) return;
    void fetchTasks();
  }, [open, fetchTasks]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeShutdownRitual();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeShutdownRitual, open]);

  const activeDate = shutdownRitualDate ?? selectedDate;
  const reflection =
    reflectionDrafts[activeDate] ?? dailyShutdownNotes[activeDate] ?? "";

  const dayTasks = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.scheduledDate === activeDate &&
            !task.isBacklog
        )
        .sort((first, second) => first.position - second.position),
    [activeDate, tasks]
  );

  const doneTasks = useMemo(
    () => dayTasks.filter((task) => task.status === "COMPLETED"),
    [dayTasks]
  );

  const openTasks = useMemo(
    () => dayTasks.filter((task) => task.status !== "COMPLETED"),
    [dayTasks]
  );

  const completedMinutes = useMemo(
    () => doneTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0),
    [doneTasks]
  );

  const totalPlannedMinutes = useMemo(
    () => dayTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0),
    [dayTasks]
  );

  const completionRate =
    dayTasks.length > 0 ? Math.round((doneTasks.length / dayTasks.length) * 100) : 0;

  const activeDateLabel = useMemo(
    () => format(parseISO(activeDate), "EEEE, d. MMMM", { locale: de }),
    [activeDate]
  );

  const shutdownDone = shutdownRitualCompletedDates.includes(activeDate);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
          style={{
            backgroundColor: "rgba(23, 19, 16, 0.34)",
            backdropFilter: "blur(7px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeShutdownRitual();
            }
          }}
        >
          <motion.div
            className="ritual-modal ritual-modal--board flex w-full max-w-[1180px] min-h-0 max-h-[calc(100dvh-32px)] flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="planning-toolbar ritual-modal__toolbar">
              <div className="flex min-w-0 items-center gap-2">
                <MoonStar size={16} strokeWidth={2} style={{ color: "var(--accent-primary)" }} />
                <span className="settings-toolbar__title truncate">
                  Shutdown fuer {activeDateLabel}
                </span>
                {shutdownDone && (
                  <span className="workspace-badge workspace-badge--success">Abgeschlossen</span>
                )}
              </div>
              <button
                type="button"
                onClick={closeShutdownRitual}
                className="planning-toolbar__button planning-toolbar__button--icon"
                aria-label="Shutdown Ritual schliessen"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="analytics-stats">
              <div className="analytics-stat">
                <p className="analytics-stat__label">Erledigt</p>
                <p className="analytics-stat__value">
                  {doneTasks.length}
                  <span style={{ color: "var(--text-muted)" }}>/{dayTasks.length}</span>
                </p>
                <div className="planning-progress ritual-progress">
                  <div
                    className="planning-progress__fill"
                    style={{ width: `${completionRate}%`, background: "var(--accent-success)" }}
                  />
                </div>
              </div>
              <div className="analytics-stat">
                <p className="analytics-stat__label">Zeit</p>
                <p className="analytics-stat__value">
                  {completedMinutes > 0 ? formatMinutes(completedMinutes) : "0 min"}
                </p>
                <p className="analytics-stat__detail">
                  {totalPlannedMinutes > 0
                    ? `von ${formatMinutes(totalPlannedMinutes)} geplant`
                    : "Ohne Zeitschaetzung"}
                </p>
              </div>
              <div className="analytics-stat">
                <p className="analytics-stat__label">Offen</p>
                <p
                  className="analytics-stat__value"
                  style={openTasks.length > 0 ? { color: "var(--accent-warning)" } : undefined}
                >
                  {openTasks.length}
                </p>
                <p className="analytics-stat__detail">
                  {openTasks.length === 0 ? "Nichts bleibt lose" : "Bleiben sichtbar"}
                </p>
              </div>
            </div>

            <div className="ritual-modal__columns">
              <section className="analytics-section">
                <h3 className="planning-column__title">Erledigt</h3>
                <p className="planning-column__date">Was heute getragen hat</p>
                <div className="analytics-section__body ritual-list">
                  {doneTasks.length > 0 ? (
                    doneTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        title={task.title}
                        meta={task.plannedTime ? formatMinutes(task.plannedTime) : null}
                        done
                      />
                    ))
                  ) : (
                    <EmptyState text="Noch nichts erledigt. Du kannst den Tag trotzdem bewusst abschliessen." />
                  )}
                </div>
              </section>

              <section className="analytics-section">
                <h3 className="planning-column__title">Offen</h3>
                <p className="planning-column__date">Was sichtbar bleibt</p>
                <div className="analytics-section__body ritual-list">
                  {openTasks.length > 0 ? (
                    openTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        title={task.title}
                        meta={
                          task.channel?.name
                            ? `#${task.channel.name}`
                            : task.plannedTime
                              ? formatMinutes(task.plannedTime)
                              : null
                        }
                      />
                    ))
                  ) : (
                    <EmptyState text="Keine offenen Punkte mehr." />
                  )}
                </div>
              </section>

              <section className="analytics-section">
                <h3 className="planning-column__title">Journal</h3>
                <p className="planning-column__date">Ein Gedanke fuer morgen</p>
                <div className="analytics-section__body">
                  <textarea
                    value={reflection}
                    onChange={(event) =>
                      setReflectionDrafts((current) => ({
                        ...current,
                        [activeDate]: event.target.value,
                      }))
                    }
                    placeholder="Was war heute gut? Was war schwer? Was soll morgen direkt wieder Klarheit haben?"
                    className="workspace-input workspace-input--textarea ritual-textarea"
                  />
                  <div className="ritual-actions">
                    <button
                      type="button"
                      onClick={() => completeShutdownRitual(activeDate, reflection)}
                      className="workspace-button workspace-button--primary"
                    >
                      <MoonStar size={15} strokeWidth={2} />
                      Feierabend
                    </button>
                    <button type="button" onClick={closeShutdownRitual} className="workspace-button">
                      Spaeter
                    </button>
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

function TaskRow({
  title,
  meta,
  done = false,
}: {
  title: string;
  meta: string | null;
  done?: boolean;
}) {
  return (
    <div className="ritual-row">
      <p
        className="settings-row__label min-w-0 flex-1 truncate"
        style={done ? { textDecoration: "line-through", color: "var(--text-secondary)" } : undefined}
      >
        {title}
      </p>
      {meta && <span className="planning-card__duration">{meta}</span>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="settings-row__description">{text}</p>;
}

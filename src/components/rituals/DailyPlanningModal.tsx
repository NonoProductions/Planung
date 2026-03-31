"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck2, Clock3, Layers3, X } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export default function DailyPlanningModal() {
  const open = useUIStore((state) => state.planningRitualOpen);
  const selectedDate = useUIStore((state) => state.selectedDate);
  const closePlanningRitual = useUIStore((state) => state.closePlanningRitual);
  const completePlanningRitual = useUIStore((state) => state.completePlanningRitual);
  const planningRitualCompletedDates = useUIStore(
    (state) => state.planningRitualCompletedDates
  );

  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  useEffect(() => {
    if (!open) return;
    void fetchTasks();
  }, [open, fetchTasks]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePlanningRitual();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closePlanningRitual, open]);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.scheduledDate === selectedDate && !task.isBacklog)
        .sort((first, second) => first.position - second.position),
    [selectedDate, tasks]
  );

  const plannedMinutes = dayTasks.reduce(
    (sum, task) => sum + (task.plannedTime || 0),
    0
  );
  const completedCount = dayTasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;
  const planningDone = planningRitualCompletedDates.includes(selectedDate);
  const focusTasks = dayTasks.filter((task) => task.status !== "COMPLETED").slice(0, 4);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
          style={{ backgroundColor: "rgba(23, 19, 16, 0.34)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlanningRitual();
            }
          }}
        >
          <motion.div
            className="ritual-modal flex w-full max-w-3xl flex-col overflow-hidden"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ritual-modal__header">
              <div className="flex items-start gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
                style={{
                  backgroundColor: "rgba(244, 239, 232, 0.92)",
                  color: "var(--accent-primary)",
                }}
              >
                <CalendarCheck2 size={19} strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="workspace-section__eyebrow">Daily Planning</p>
                  {planningDone && (
                    <span className="workspace-badge workspace-badge--accent">
                      Heute bereits abgeschlossen
                    </span>
                  )}
                </div>
                <h2
                  className="mt-2 text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.045em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Planung fuer {format(parseISO(selectedDate), "EEEE, d. MMMM", { locale: de })}
                </h2>
                <p
                  className="mt-2 max-w-2xl text-[0.98rem]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Ein kurzer Check-in fuer Fokus, Umfang und die wichtigsten Aufgaben des Tages.
                </p>
              </div>

              <button
                type="button"
                onClick={closePlanningRitual}
                className="workspace-button h-10 w-10 px-0"
                style={{ color: "var(--text-muted)" }}
                aria-label="Planning Ritual schliessen"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            </div>

            <div className="ritual-modal__body">
              <div className="grid gap-4 sm:grid-cols-3">
              <RitualStat
                icon={<Layers3 size={16} strokeWidth={2} />}
                label="Tasks im Plan"
                value={String(dayTasks.length)}
                detail={
                  dayTasks.length === 0
                    ? "Noch nichts geplant"
                    : `${Math.max(dayTasks.length - completedCount, 0)} offen`
                }
                color="var(--accent-primary)"
              />
              <RitualStat
                icon={<Clock3 size={16} strokeWidth={2} />}
                label="Geplante Zeit"
                value={plannedMinutes > 0 ? formatMinutes(plannedMinutes) : "Offen"}
                detail={
                  plannedMinutes > 0
                    ? "Heute bewusst begrenzen"
                    : "Schaetzung fehlt noch"
                }
                color="var(--accent-warning)"
              />
              <RitualStat
                icon={<CalendarCheck2 size={16} strokeWidth={2} />}
                label="Schon erledigt"
                value={`${completedCount}`}
                detail={completedCount > 0 ? "Momentum ist da" : "Frischer Start"}
                color="var(--accent-success)"
              />
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-[1.15fr_0.85fr]">
              <section className="workspace-surface workspace-section workspace-surface--soft">
                <p className="workspace-section__eyebrow">Fokus fuer heute</p>
                <div className="mt-4 space-y-3">
                  {focusTasks.length > 0 ? (
                    focusTasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="workspace-list-item flex items-start gap-3"
                      >
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-semibold"
                          style={{
                            backgroundColor: "rgba(141, 124, 246, 0.14)",
                            color: "var(--accent-primary)",
                          }}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-[0.96rem] font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {task.title}
                          </p>
                          <p
                            className="mt-1 text-[0.82rem]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {task.plannedTime
                              ? `${formatMinutes(task.plannedTime)} eingeplant`
                              : "Noch ohne Zeitschaetzung"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="workspace-note text-[0.95rem]">
                      Noch keine offenen Tasks fuer heute. Du kannst direkt mit einem leeren Fokus starten oder zuerst Aufgaben anlegen.
                    </div>
                  )}
                </div>
              </section>

              <section className="workspace-surface workspace-section workspace-surface--accent">
                <p className="workspace-section__eyebrow">Ritual Abschluss</p>
                <h3
                  className="mt-3 text-[1.18rem] font-semibold tracking-[-0.03em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Tag bewusst starten
                </h3>
                <p
                  className="mt-2 text-[0.92rem]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Wenn dein Plan fuer heute stimmig ist, schliesse das Ritual ab und starte mit einer kleinen Celebration in den Tag.
                </p>

                <button
                  type="button"
                  onClick={() => completePlanningRitual(selectedDate)}
                  className="workspace-button workspace-button--primary mt-5 w-full"
                >
                  Ritual abschliessen
                </button>

                <button
                  type="button"
                  onClick={closePlanningRitual}
                  className="workspace-button mt-3 w-full"
                >
                  Weiter planen
                </button>
              </section>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RitualStat({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="workspace-surface workspace-section">
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span
          className="text-[0.76rem] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
      </div>
      <p
        className="mt-3 text-[1.45rem] font-semibold leading-[1.02] tracking-[-0.04em]"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="mt-2 text-[0.84rem]" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

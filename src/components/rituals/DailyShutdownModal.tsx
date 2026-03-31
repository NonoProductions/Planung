"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  Clock3,
  ListTodo,
  MoonStar,
  NotebookText,
  X,
} from "lucide-react";
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
            className="ritual-modal flex w-full max-w-[1180px] min-h-0 max-h-[calc(100dvh-32px)] flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]"
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
                  <MoonStar size={18} strokeWidth={1.9} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="workspace-section__eyebrow">Daily Shutdown</p>
                    <StatusPill
                      label={shutdownDone ? "Bereits abgeschlossen" : "Abendritual"}
                      tone={shutdownDone ? "success" : "neutral"}
                    />
                  </div>
                  <h2
                    className="mt-3 max-w-[22ch] text-[30px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[34px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Ein ruhiger Abschluss fuer {activeDateLabel}
                  </h2>
                  <p
                    className="mt-3 max-w-[62ch] text-[14px] leading-7"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Das gleiche ruhige Karten- und Typografie-System wie auf den
                    anderen Seiten, nur als konzentrierter Abendblick auf deinen
                    Tag.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeShutdownRitual}
                  className="workspace-button h-10 w-10 px-0"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Shutdown Ritual schliessen"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                <section className="workspace-surface workspace-section">
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <p className="workspace-section__eyebrow">Tagesbild</p>
                      <p
                        className="mt-3 text-[40px] font-semibold leading-[0.95] tracking-[-0.075em]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {doneTasks.length}
                        <span
                          className="ml-1 text-[28px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          / {dayTasks.length || 0}
                        </span>
                      </p>
                    </div>

                    <div className="min-w-[180px] flex-1">
                      <div
                        className="h-3 overflow-hidden rounded-full"
                        style={{ backgroundColor: "rgba(229, 222, 213, 0.92)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${completionRate}%`,
                            background:
                              "linear-gradient(90deg, var(--accent-success), #7bc892)",
                          }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill label={`${completionRate}% erledigt`} tone="success" />
                        <StatusPill
                          label={
                            totalPlannedMinutes > 0
                              ? `${formatMinutes(totalPlannedMinutes)} geplant`
                              : "Ohne Zeitschaetzung"
                          }
                          tone="neutral"
                        />
                        <StatusPill
                          label={`${openTasks.length} offen`}
                          tone={openTasks.length === 0 ? "success" : "warning"}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                  <ShutdownStat
                    icon={<CheckCheck size={16} strokeWidth={2} />}
                    label="Erledigt"
                    value={`${doneTasks.length}`}
                    detail={doneTasks.length > 0 ? "bewusst abgeschlossen" : "noch offen"}
                    color="var(--accent-success)"
                  />
                  <ShutdownStat
                    icon={<Clock3 size={16} strokeWidth={2} />}
                    label="Zeit"
                    value={completedMinutes > 0 ? formatMinutes(completedMinutes) : "0m"}
                    detail="auf Basis der Planung"
                    color="var(--accent-warning)"
                  />
                  <ShutdownStat
                    icon={<ListTodo size={16} strokeWidth={2} />}
                    label="Offene Punkte"
                    value={String(openTasks.length)}
                    detail={openTasks.length === 0 ? "nichts bleibt lose" : "bleiben sichtbar"}
                    color="var(--accent-primary)"
                  />
                </div>
              </div>
            </div>

            <div className="ritual-modal__body">
              <div className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
                <div className="space-y-5">
                  <SurfaceCard
                    eyebrow="Rueckblick"
                    title="Was heute getragen hat"
                    icon={<CheckCheck size={16} strokeWidth={1.9} />}
                  >
                    <div className="space-y-3">
                      {doneTasks.length > 0 ? (
                        doneTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            title={task.title}
                            meta={
                              task.plannedTime
                                ? `${formatMinutes(task.plannedTime)} geplant`
                                : "Ohne Zeitschaetzung"
                            }
                            accent="var(--accent-success)"
                          />
                        ))
                      ) : (
                        <EmptyState text="Noch nichts als erledigt markiert. Du kannst den Tag trotzdem mit einer klaren Notiz und einem bewussten Abschluss parken." />
                      )}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard
                    eyebrow="Offen"
                    title="Was noch sichtbar bleibt"
                    icon={<ListTodo size={16} strokeWidth={1.9} />}
                  >
                    <div className="space-y-3">
                      {openTasks.length > 0 ? (
                        openTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            title={task.title}
                            meta={
                              task.channel?.name
                                ? `#${task.channel.name}`
                                : task.plannedTime
                                  ? `${formatMinutes(task.plannedTime)} geplant`
                                  : "Bleibt offen"
                            }
                            accent="var(--accent-warning)"
                          />
                        ))
                      ) : (
                        <EmptyState text="Keine offenen Punkte mehr. Der Tag wirkt gerade so ruhig, wie er sich nach Feierabend anfuehlen sollte." />
                      )}
                    </div>
                  </SurfaceCard>
                </div>

                <div className="space-y-5">
                  <SurfaceCard
                    eyebrow="Journal"
                    title="Eine kurze Landung fuer morgen"
                    icon={<NotebookText size={16} strokeWidth={1.9} />}
                    accent
                  >
                    <p
                      className="mb-4 text-[13px] leading-6"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Keine lange Auswertung, nur ein sauberer Gedanke fuer dein
                      Morgen-Ich.
                    </p>
                    <textarea
                      value={reflection}
                      onChange={(event) =>
                        setReflectionDrafts((current) => ({
                          ...current,
                          [activeDate]: event.target.value,
                        }))
                      }
                      placeholder="Was war heute gut? Was war schwer? Was soll morgen direkt wieder Klarheit haben?"
                      className="workspace-input workspace-input--textarea min-h-44 w-full resize-none text-[14px] leading-7"
                    />
                  </SurfaceCard>

                  <SurfaceCard
                    eyebrow="Abschluss"
                    title="Bereit fuer Feierabend"
                    icon={<MoonStar size={16} strokeWidth={1.9} />}
                  >
                    <div className="space-y-4">
                      <div
                        className="rounded-[24px] border px-4 py-4"
                        style={{
                          borderColor: "rgba(227, 218, 209, 0.92)",
                          backgroundColor: "rgba(255, 252, 248, 0.82)",
                        }}
                      >
                        <p
                          className="text-[13px] leading-6"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Der Shutdown markiert den Tag als bewusst abgeschlossen
                          und speichert deine Notiz fuer spaeter.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => completeShutdownRitual(activeDate, reflection)}
                        className="workspace-button workspace-button--primary w-full"
                      >
                        Feierabend einlaeuten
                      </button>

                      <button
                        type="button"
                        onClick={closeShutdownRitual}
                        className="workspace-button w-full"
                      >
                        Spaeter abschliessen
                      </button>
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShutdownStat({
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
          className="text-[12px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
      </div>
      <p
        className="mt-3 text-[28px] font-semibold leading-[1.02] tracking-[-0.05em]"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function SurfaceCard({
  eyebrow,
  title,
  icon,
  children,
  accent = false,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`workspace-surface workspace-section ${accent ? "workspace-surface--accent" : ""}`}>
      <div className="workspace-section__header">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{
            backgroundColor: accent
              ? "rgba(141, 124, 246, 0.14)"
              : "rgba(244, 239, 232, 0.92)",
            color: accent ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          {icon}
        </span>
        <div className="workspace-section__intro">
          <p className="workspace-section__eyebrow">{eyebrow}</p>
          <h3 className="workspace-section__title">{title}</h3>
        </div>
      </div>

      <div className="workspace-section__body">{children}</div>
    </section>
  );
}

function TaskRow({
  title,
  meta,
  accent,
}: {
  title: string;
  meta: string;
  accent: string;
}) {
  return (
    <div className="workspace-list-item">
      <p
        className="truncate text-[15px] font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: accent }}>
        {meta}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="workspace-note text-[14px] leading-7">
      {text}
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning";
}) {
  const styles =
    tone === "success"
      ? {
          backgroundColor: "var(--accent-success-light)",
          color: "var(--accent-success)",
        }
      : tone === "warning"
        ? {
            backgroundColor: "var(--accent-warning-light)",
            color: "var(--accent-warning)",
          }
        : {
            backgroundColor: "rgba(244, 239, 232, 0.9)",
            color: "var(--text-secondary)",
          };

  return (
    <span
      className="workspace-badge"
      style={styles}
    >
      {label}
    </span>
  );
}

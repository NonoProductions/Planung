"use client";

import { useEffect, useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Clock, Flag, TrendingUp, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTaskStore } from "@/stores/taskStore";
import { toLocalDateString } from "@/lib/date";
import { isDeadlineTask } from "@/components/weekly/WeeklyDeadlines";

interface Props {
  weekStart: string;
  onClose: () => void;
}

function fmtMins(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export default function WeeklyReviewModal({ weekStart, onClose }: Props) {
  const tasks = useTaskStore((state) => state.tasks);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => toLocalDateString(addDays(parseISO(weekStart), index))),
    [weekStart]
  );
  const weekEnd = weekDays[6];

  const weekTasks = useMemo(
    () => tasks.filter((task) => task.scheduledDate && task.scheduledDate >= weekStart && task.scheduledDate <= weekEnd),
    [tasks, weekStart, weekEnd]
  );

  const completedTasks = weekTasks.filter((task) => task.status === "COMPLETED");
  const totalPlanned = weekTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0);
  const completedPlanned = completedTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0);
  const completionRate = weekTasks.length > 0 ? Math.round((completedTasks.length / weekTasks.length) * 100) : 0;

  const deadlines = tasks.filter(
    (task) => isDeadlineTask(task) && task.dueDate! >= weekStart && task.dueDate! <= weekEnd
  );
  const deadlinesDone = deadlines.filter((task) => task.status === "COMPLETED").length;

  const byDay = useMemo(
    () =>
      weekDays.map((day) => {
        const dayTasks = weekTasks.filter((task) => task.scheduledDate === day);
        const done = dayTasks.filter((task) => task.status === "COMPLETED");
        return {
          day,
          total: dayTasks.length,
          done: done.length,
          planned: dayTasks.reduce((sum, task) => sum + (task.plannedTime || 0), 0),
          donePlanned: done.reduce((sum, task) => sum + (task.plannedTime || 0), 0),
        };
      }),
    [weekTasks, weekDays]
  );
  const maxDayPlanned = Math.max(...byDay.map((day) => day.planned), 1);

  const byChannel = useMemo(() => {
    const map: Record<string, { name: string; color: string; total: number }> = {};
    for (const task of weekTasks) {
      const key = task.channelId || "none";
      map[key] ??= {
        name: task.channel?.name ?? "Ohne Channel",
        color: task.channel?.color ?? "var(--text-muted)",
        total: 0,
      };
      map[key].total += task.plannedTime || 0;
    }
    return Object.values(map)
      .filter((channel) => channel.total > 0)
      .sort((first, second) => second.total - first.total);
  }, [weekTasks]);

  // A breakdown with only "Ohne Channel" says nothing, so it is shown once channels are used.
  const showChannels = weekTasks.some((task) => task.channelId) && byChannel.length > 0;

  const isEmpty = weekTasks.length === 0 && deadlines.length === 0;

  return (
    <AnimatePresence>
      <motion.div
        key="review-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="app-overlay z-50"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          key="review-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="week-review-title"
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="ritual-modal ritual-modal--board week-review"
        >
          <header className="week-review__header">
            <TrendingUp size={18} strokeWidth={1.8} className="week-review__icon" />
            <div className="min-w-0">
              <h2 id="week-review-title" className="week-review__title">
                Wochenrückblick
              </h2>
              <p className="week-review__range">
                {format(parseISO(weekStart), "d. MMMM", { locale: de })} –{" "}
                {format(parseISO(weekEnd), "d. MMMM yyyy", { locale: de })}
              </p>
            </div>
            <button type="button" onClick={onClose} className="week-review__close" aria-label="Schließen">
              <X size={16} strokeWidth={1.8} />
            </button>
          </header>

          <div className="week-review__body">
            {isEmpty ? (
              <p className="week-review__empty">Für diese Woche ist noch nichts eingetragen.</p>
            ) : (
              <>
                <div className="week-review__kpis">
                  <KpiCard
                    icon={<CheckCircle2 size={15} strokeWidth={1.9} />}
                    color="var(--accent-success)"
                    label="Erledigt"
                    value={`${completedTasks.length} / ${weekTasks.length}`}
                    sub={weekTasks.length > 0 ? `${completionRate} % der Tasks` : "Keine Tasks geplant"}
                  />
                  <KpiCard
                    icon={<Clock size={15} strokeWidth={1.9} />}
                    color="var(--accent-primary)"
                    label="Geplante Zeit"
                    value={totalPlanned > 0 ? fmtMins(totalPlanned) : "–"}
                    sub={totalPlanned > 0 ? `davon ${fmtMins(completedPlanned)} erledigt` : "Keine Zeiten eingetragen"}
                  />
                  <KpiCard
                    icon={<Flag size={15} strokeWidth={1.9} />}
                    color="var(--accent-warning)"
                    label="Abgaben"
                    value={deadlines.length > 0 ? `${deadlinesDone} / ${deadlines.length}` : "–"}
                    sub={
                      deadlines.length === 0
                        ? "Diese Woche nichts fällig"
                        : deadlinesDone === deadlines.length
                          ? "Alles abgegeben"
                          : `${deadlines.length - deadlinesDone} noch offen`
                    }
                  />
                </div>

                <section className="week-review__section">
                  <h3 className="week-review__heading">Tage</h3>
                  <ul className="week-review__days">
                    {byDay.map(({ day, total, done, planned, donePlanned }) => (
                      <li key={day} className={`week-review__day${total === 0 ? " is-empty" : ""}`}>
                        <span className="week-review__day-name">
                          {format(parseISO(day), "EEEEEE", { locale: de })}
                        </span>
                        <div className="week-review__track">
                          {planned > 0 && (
                            <motion.div
                              className="week-review__bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${(planned / maxDayPlanned) * 100}%` }}
                              transition={{ duration: 0.45 }}
                            >
                              <div
                                className="week-review__bar-done"
                                style={{ width: `${(donePlanned / planned) * 100}%` }}
                              />
                            </motion.div>
                          )}
                        </div>
                        <span className="week-review__day-value">
                          {total === 0 ? "–" : `${done}/${total}${planned > 0 ? ` · ${fmtMins(planned)}` : ""}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="week-review__legend">
                    <span className="week-review__swatch is-done" /> erledigt
                    <span className="week-review__swatch" /> geplant
                  </p>
                </section>

                {showChannels && (
                  <section className="week-review__section">
                    <h3 className="week-review__heading">Zeit nach Channel</h3>
                    <ul className="week-review__days">
                      {byChannel.map((channel) => (
                        <li key={channel.name} className="week-review__channel">
                          <span className="week-review__channel-name">
                            <span className="week-review__dot" style={{ backgroundColor: channel.color }} />
                            <span className="truncate">{channel.name}</span>
                          </span>
                          <div className="week-review__track">
                            <motion.div
                              className="week-review__bar"
                              style={{ backgroundColor: channel.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(channel.total / totalPlanned) * 100}%` }}
                              transition={{ duration: 0.45 }}
                            />
                          </div>
                          <span className="week-review__day-value">{fmtMins(channel.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>

          <footer className="week-review__footer">
            <button type="button" onClick={onClose} className="workspace-button workspace-button--primary">
              Schließen
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function KpiCard({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="week-review__kpi">
      <span className="week-review__kpi-label">
        <span style={{ color }}>{icon}</span>
        {label}
      </span>
      <span className="week-review__kpi-value">{value}</span>
      <span className="week-review__kpi-sub">{sub}</span>
    </div>
  );
}

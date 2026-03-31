"use client";

import { useEffect, useMemo } from "react";
import { addDays, parseISO, isSameDay, format } from "date-fns";
import { de } from "date-fns/locale";
import { X, CheckCircle2, Target, Clock, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/stores/taskStore";
import { useObjectiveStore } from "@/stores/objectiveStore";

interface Props {
  weekStart: string;
  onClose: () => void;
}

export default function WeeklyReviewModal({ weekStart, onClose }: Props) {
  const { tasks } = useTaskStore();
  const { objectives, fetchObjectives } = useObjectiveStore();

  useEffect(() => {
    fetchObjectives(weekStart);
  }, [weekStart, fetchObjectives]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const weekDays = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  // Tasks belonging to this week
  const weekTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.scheduledDate) return false;
      const d = parseISO(t.scheduledDate);
      return weekDays.some((day) => isSameDay(d, day));
    });
  }, [tasks, weekDays]);

  const completedTasks = weekTasks.filter((t) => t.status === "COMPLETED");
  const totalPlanned = weekTasks.reduce((s, t) => s + (t.plannedTime || 0), 0);
  const completedPlanned = completedTasks.reduce((s, t) => s + (t.plannedTime || 0), 0);
  const completionRate =
    weekTasks.length > 0 ? Math.round((completedTasks.length / weekTasks.length) * 100) : 0;

  // Time by channel
  const byChannel = useMemo(() => {
    const map: Record<string, { name: string; color: string; total: number; done: number }> = {};
    for (const t of weekTasks) {
      const key = t.channelId || "none";
      if (!map[key]) {
        map[key] = {
          name: t.channel?.name ?? "Ohne Channel",
          color: t.channel?.color ?? "var(--text-muted)",
          total: 0,
          done: 0,
        };
      }
      map[key].total += t.plannedTime || 0;
      if (t.status === "COMPLETED") map[key].done += t.plannedTime || 0;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [weekTasks]);

  // Tasks per day
  const byDay = useMemo(() => {
    return weekDays.map((day) => {
      const dayTasks = weekTasks.filter((t) => {
        if (!t.scheduledDate) return false;
        return isSameDay(parseISO(t.scheduledDate), day);
      });
      return {
        day,
        total: dayTasks.length,
        done: dayTasks.filter((t) => t.status === "COMPLETED").length,
        planned: dayTasks.reduce((s, t) => s + (t.plannedTime || 0), 0),
      };
    });
  }, [weekTasks, weekDays]);

  const weekObjectives = objectives.filter((o) => o.weekStart === weekStart);
  const completedObjectives = weekObjectives.filter((o) => o.progress >= 100);

  function fmtMins(m: number) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h === 0) return `${min}m`;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}m`;
  }

  const maxDayPlanned = Math.max(...byDay.map((d) => d.planned), 1);

  return (
    <AnimatePresence>
      <motion.div
        key="review-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
        style={{ backgroundColor: "rgba(10,10,8,0.45)", backdropFilter: "blur(4px)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          key="review-panel"
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-subtle)",
            maxHeight: "88vh",
          }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center gap-3 px-4 py-4 sm:px-6 sm:py-5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <TrendingUp size={18} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} />
            <div>
              <h2
                className="text-[15px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Wochenrückblick
              </h2>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(weekStart), "d. MMMM", { locale: de })} –{" "}
                {format(addDays(parseISO(weekStart), 6), "d. MMMM yyyy", { locale: de })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
              aria-label="Schließen"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {/* KPI row */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                icon={<CheckCircle2 size={16} strokeWidth={1.8} />}
                label="Erledigt"
                value={`${completedTasks.length} / ${weekTasks.length}`}
                sub={`${completionRate}% Erledigungsrate`}
                color="var(--accent-success)"
              />
              <KpiCard
                icon={<Clock size={16} strokeWidth={1.8} />}
                label="Geplante Zeit"
                value={fmtMins(totalPlanned)}
                sub={`${fmtMins(completedPlanned)} erledigt`}
                color="var(--accent-primary)"
              />
              <KpiCard
                icon={<Target size={16} strokeWidth={1.8} />}
                label="Wochenziele"
                value={`${completedObjectives.length} / ${weekObjectives.length}`}
                sub={
                  weekObjectives.length === 0
                    ? "Keine Ziele gesetzt"
                    : completedObjectives.length === weekObjectives.length
                      ? "Alle erreicht!"
                      : "In Arbeit"
                }
                color="var(--accent-warning)"
              />
            </div>

            {/* Daily breakdown */}
            <section className="mb-6">
              <h3
                className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Tagesübersicht
              </h3>
              <div className="space-y-2">
                {byDay.map(({ day, total, done, planned }) => (
                  <div key={day.toISOString()} className="flex items-center gap-3">
                    <span
                      className="w-8 shrink-0 text-[12px] font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {format(day, "EEE", { locale: de })}
                    </span>

                    <div className="flex-1">
                      <div
                        className="h-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--bg-hover)" }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(planned / maxDayPlanned) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.05 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: "var(--accent-primary)", opacity: 0.35 }}
                        />
                      </div>
                      <div
                        className="h-2 -mt-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: "transparent" }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: total > 0 ? `${(done / total) * (planned / maxDayPlanned) * 100}%` : "0%",
                          }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: "var(--accent-success)" }}
                        />
                      </div>
                    </div>

                    <span
                      className="w-16 shrink-0 text-right text-[11px] sm:w-20 sm:text-[11.5px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {done}/{total} · {fmtMins(planned)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Channel breakdown */}
            {byChannel.length > 0 && (
              <section className="mb-6">
                <h3
                  className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Zeitverteilung nach Channel
                </h3>
                <div className="space-y-2.5">
                  {byChannel.map((ch) => (
                    <div key={ch.name} className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: ch.color }}
                      />
                      <span
                        className="w-24 shrink-0 truncate text-[12px] font-medium sm:w-32 sm:text-[12.5px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {ch.name}
                      </span>
                      <div
                        className="flex-1 overflow-hidden rounded-full"
                        style={{ height: 6, backgroundColor: "var(--bg-hover)" }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(ch.total / totalPlanned) * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: ch.color, opacity: 0.7 }}
                        />
                      </div>
                      <span
                        className="w-12 shrink-0 text-right text-[11px] sm:text-[11.5px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {fmtMins(ch.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Objectives */}
            {weekObjectives.length > 0 && (
              <section>
                <h3
                  className="mb-3 text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Wochenziele
                </h3>
                <div className="space-y-2">
                  {weekObjectives.map((obj) => (
                    <div key={obj.id} className="flex items-center gap-3">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor:
                            obj.progress >= 100
                              ? "var(--accent-success)"
                              : "var(--bg-hover)",
                          border:
                            obj.progress >= 100
                              ? "none"
                              : "1.5px solid var(--border-color)",
                        }}
                      >
                        {obj.progress >= 100 && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2 5l2.5 2.5L8 3"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className="flex-1 text-[13px] font-medium"
                        style={{
                          color:
                            obj.progress >= 100
                              ? "var(--text-muted)"
                              : "var(--text-primary)",
                          textDecoration:
                            obj.progress >= 100 ? "line-through" : "none",
                        }}
                      >
                        {obj.title}
                      </span>
                      <span
                        className="shrink-0 text-[11.5px] font-medium"
                        style={{
                          color:
                            obj.progress >= 100
                              ? "var(--accent-success)"
                              : "var(--text-muted)",
                        }}
                      >
                        {obj.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {weekTasks.length === 0 && weekObjectives.length === 0 && (
              <div
                className="py-12 text-center text-[14px]"
                style={{ color: "var(--text-muted)" }}
              >
                Keine Daten für diese Woche vorhanden.
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex shrink-0 justify-end px-4 py-4 sm:px-6"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              onClick={onClose}
              className="rounded-xl px-5 py-2 text-[13px] font-medium transition-all duration-150"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "white",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--accent-primary-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--accent-primary)";
              }}
            >
              Schließen
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-4"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <span className="text-[22px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
        {sub}
      </span>
    </div>
  );
}

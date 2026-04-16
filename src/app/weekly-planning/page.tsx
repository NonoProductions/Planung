"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, addWeeks, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  BarChart2,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Sparkles,
  Target,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import DndWrapper from "@/components/dnd/DndWrapper";
import WeekGrid from "@/components/weekly/WeekGrid";
import WeeklyObjectives from "@/components/weekly/WeeklyObjectives";
import WeeklyReviewModal from "@/components/weekly/WeeklyReviewModal";
import { toLocalDateString } from "@/lib/date";
import { useObjectiveStore } from "@/stores/objectiveStore";
import { useTaskStore } from "@/stores/taskStore";

function getWeekStart(date: Date): string {
  return toLocalDateString(startOfWeek(date, { weekStartsOn: 1 }));
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

export default function WeeklyPlanningPage() {
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showReview, setShowReview] = useState(false);

  const tasks = useTaskStore((state) => state.tasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const objectives = useObjectiveStore((state) => state.objectives);
  const fetchObjectives = useObjectiveStore((state) => state.fetchObjectives);

  const weekStartStr = getWeekStart(currentWeek);

  useEffect(() => {
    void fetchTasks();
    void fetchObjectives(weekStartStr);
  }, [fetchObjectives, fetchTasks, weekStartStr]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeek, index)),
    [currentWeek]
  );

  const weekLabel = `${format(currentWeek, "d. MMM", { locale: de })} - ${format(
    addDays(currentWeek, 6),
    "d. MMM yyyy",
    { locale: de }
  )}`;

  const weekTasks = useMemo(() => {
    const daySet = new Set(weekDays.map((day) => toLocalDateString(day)));
    return tasks.filter((task) => task.scheduledDate && daySet.has(task.scheduledDate));
  }, [tasks, weekDays]);

  const completedTasks = weekTasks.filter((task) => task.status === "COMPLETED").length;
  const plannedMinutes = weekTasks.reduce((sum, task) => sum + (task.plannedTime ?? 0), 0);
  const completionRate =
    weekTasks.length > 0 ? Math.round((completedTasks / weekTasks.length) * 100) : 0;

  const weekObjectives = objectives.filter((objective) => objective.weekStart === weekStartStr);
  const completedObjectives = weekObjectives.filter((objective) => objective.progress >= 100).length;

  function prevWeek() {
    setCurrentWeek((date) => subWeeks(date, 1));
  }

  function nextWeek() {
    setCurrentWeek((date) => addWeeks(date, 1));
  }

  function goToCurrentWeek() {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  return (
    <DndWrapper>
      <AppShell>
        <div className="app-main-surface">
          <div className="weekly-planning-shell">
            <section className="weekly-planning-hero">
              <div className="weekly-planning-hero__badge">
                <CalendarRange size={14} strokeWidth={2} />
                Weekly Planning
              </div>

              <div className="weekly-planning-hero__headline">
                <h1>Baue deinen Wochenfokus mit klaren Prioritaeten.</h1>
                <p>
                  Plane Ziele, verteile Aufgaben ueber die Woche und schliesse mit einem
                  Wochenrueckblick ab.
                </p>
              </div>

              <div className="weekly-planning-kpis">
                <KpiCard
                  icon={<CheckCircle2 size={15} strokeWidth={2} />}
                  label="Erledigt"
                  value={`${completedTasks}/${weekTasks.length || 0}`}
                  hint={`${completionRate}% Abschlussquote`}
                />
                <KpiCard
                  icon={<Clock3 size={15} strokeWidth={2} />}
                  label="Geplante Zeit"
                  value={formatMinutes(plannedMinutes)}
                  hint="Ueber alle Wochenaufgaben"
                />
                <KpiCard
                  icon={<Target size={15} strokeWidth={2} />}
                  label="Wochenziele"
                  value={`${completedObjectives}/${weekObjectives.length || 0}`}
                  hint="Fortschritt deiner Ziele"
                />
              </div>
            </section>

            <section className="weekly-planning-surface">
              <div className="weekly-planning-toolbar">
                <div className="weekly-planning-toolbar__nav">
                  <button
                    onClick={prevWeek}
                    className="weekly-planning-toolbar__icon"
                    aria-label="Vorherige Woche"
                  >
                    <ChevronLeft size={16} strokeWidth={1.9} />
                  </button>

                  <button onClick={goToCurrentWeek} className="weekly-planning-toolbar__label">
                    {weekLabel}
                  </button>

                  <button
                    onClick={nextWeek}
                    className="weekly-planning-toolbar__icon"
                    aria-label="Naechste Woche"
                  >
                    <ChevronRight size={16} strokeWidth={1.9} />
                  </button>
                </div>

                <div className="weekly-planning-toolbar__meta">
                  <Sparkles size={13} strokeWidth={2} />
                  Fokusfenster
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowReview(true)}
                  className="weekly-planning-toolbar__review"
                >
                  <BarChart2 size={14} strokeWidth={2} />
                  Wochenrueckblick
                </motion.button>
              </div>

              <div className="weekly-planning-layout">
                <aside className="weekly-planning-layout__objectives">
                  <WeeklyObjectives weekStart={weekStartStr} />
                </aside>

                <div className="weekly-planning-layout__grid">
                  <WeekGrid weekStart={weekStartStr} />
                </div>
              </div>
            </section>
          </div>
        </div>

        {showReview && (
          <WeeklyReviewModal weekStart={weekStartStr} onClose={() => setShowReview(false)} />
        )}
      </AppShell>
    </DndWrapper>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="weekly-planning-kpi-card">
      <div className="weekly-planning-kpi-card__head">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}
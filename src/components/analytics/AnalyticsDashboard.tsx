"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutGrid,
  LoaderCircle,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildAnalyticsSnapshot } from "@/lib/analytics";
import { toLocalDateString } from "@/lib/date";
import {
  formatCompactMinutes,
  secondsToMinutes,
  TIME_ENTRY_CREATED_EVENT,
} from "@/lib/time-tracking";
import type { AnalyticsSnapshot, TimeEntry } from "@/types";
import TimeTrackingPanel from "@/components/analytics/TimeTrackingPanel";

function axisTick(minutes: number) {
  if (minutes <= 0) return "0h";
  return `${Math.round(minutes / 60)}h`;
}

function formatDelta(minutes: number) {
  if (minutes === 0) return "0s";
  return `${minutes > 0 ? "+" : "-"}${formatCompactMinutes(Math.abs(minutes))}`;
}

function getActiveDays(snapshot: AnalyticsSnapshot) {
  return snapshot.daily.filter(
    (day) => day.actualMinutes > 0 || day.plannedMinutes > 0 || day.totalTasks > 0
  ).length;
}

function getBestDay(snapshot: AnalyticsSnapshot) {
  return snapshot.daily.reduce((best, day) =>
    day.actualMinutes > best.actualMinutes ? day : best
  );
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name: string; value: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="workspace-surface px-4 py-3"
      style={{
        backgroundColor: "rgba(255, 252, 248, 0.98)",
      }}
    >
      <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color ?? "var(--accent-primary)" }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
            <span className="ml-auto font-medium" style={{ color: "var(--text-primary)" }}>
              {formatCompactMinutes(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SurfaceCard({
  title,
  eyebrow,
  children,
  action,
  copy,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  copy?: string;
}) {
  return (
    <section className="workspace-surface workspace-section">
      <div className="workspace-section__header">
        <div className="workspace-section__intro">
          {eyebrow && (
            <p className="workspace-section__eyebrow">{eyebrow}</p>
          )}
          <h3 className="workspace-section__title">{title}</h3>
          {copy && <p className="workspace-section__copy">{copy}</p>}
        </div>
        {action}
      </div>
      <div className="workspace-section__body">{children}</div>
    </section>
  );
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "accent" | "neutral" | "success" | "warning" | "danger";
}) {
  const toneClassName =
    tone === "accent"
      ? "workspace-badge--accent"
      : tone === "success"
        ? "workspace-badge--success"
        : tone === "warning"
          ? "workspace-badge--warning"
          : tone === "danger"
            ? "workspace-badge--danger"
            : "";

  return <span className={`workspace-badge ${toneClassName}`}>{label}</span>;
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="workspace-surface workspace-section analytics-stat-card flex min-h-[152px] flex-col justify-between">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
            style={{
              backgroundColor: "rgba(244, 239, 232, 0.9)",
              color: "var(--accent-primary)",
            }}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {label}
            </p>
            <p
              className="break-words text-[28px] font-semibold leading-[1.02] tracking-[-0.055em] md:text-[30px]"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
          </div>
        </div>
      </div>
      <p className="max-w-[34ch] text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function HeroSummaryCard({
  weekLabel,
  actualMinutes,
  plannedMinutes,
  alignmentRate,
  averageSessionMinutes,
}: {
  weekLabel: string;
  actualMinutes: number;
  plannedMinutes: number;
  alignmentRate: number;
  averageSessionMinutes: number;
}) {
  return (
    <div className="workspace-surface workspace-section analytics-hero-card">
      <p className="workspace-section__eyebrow">Current Week</p>
      <h2 className="analytics-hero-card__title">Der Wochenpuls auf einen Blick</h2>
      <p className="workspace-section__copy">
        Fokuszeit, Planabgleich und Session-Rhythmus in einer kompakten Karte.
      </p>

      <div className="analytics-hero-card__metrics">
        <div className="analytics-hero-card__metric">
          <p className="analytics-hero-card__label">Zeitraum</p>
          <p className="analytics-hero-card__detail">{weekLabel}</p>
        </div>

        <div className="analytics-hero-card__metric-row">
          <div>
            <p className="analytics-hero-card__label">Getrackt</p>
            <p className="analytics-hero-card__value">{formatCompactMinutes(actualMinutes)}</p>
          </div>
          <div>
            <p className="analytics-hero-card__label">Geplant</p>
            <p className="analytics-hero-card__value analytics-hero-card__value--secondary">
              {formatCompactMinutes(plannedMinutes)}
            </p>
          </div>
        </div>
      </div>

      <div className="analytics-hero-card__footer">
        <StatusPill label={`${alignmentRate}% Planabgleich`} tone="accent" />
        <StatusPill
          label={
            averageSessionMinutes > 0
              ? `${formatCompactMinutes(averageSessionMinutes)} pro Session`
              : "Noch keine Sessions"
          }
          tone="warning"
        />
      </div>
    </div>
  );
}

function InsightCard({
  eyebrow,
  value,
  label,
  detail,
}: {
  eyebrow: string;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="workspace-surface analytics-insight-card">
      <p className="analytics-insight-card__eyebrow">{eyebrow}</p>
      <p className="analytics-insight-card__value">{value}</p>
      <p className="analytics-insight-card__label">{label}</p>
      <p className="analytics-insight-card__detail">{detail}</p>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const rangeStart = toLocalDateString(startOfWeek(currentWeek, { weekStartsOn: 1 }));
  const rangeEnd = toLocalDateString(endOfWeek(currentWeek, { weekStartsOn: 1 }));
  const weekLabel = `${format(currentWeek, "d. MMM", { locale: de })} - ${format(
    endOfWeek(currentWeek, { weekStartsOn: 1 }),
    "d. MMM yyyy",
    { locale: de }
  )}`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analytics?start=${rangeStart}&end=${rangeEnd}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("analytics-load-failed");
        }

        const data = (await response.json()) as AnalyticsSnapshot;
        setSnapshot(data);
        setApiUnavailable(response.headers.get("x-db-unavailable") === "true");
      } catch {
        if (controller.signal.aborted) return;
        setError("Analytics konnten nicht geladen werden.");
        setSnapshot(null);
        setApiUnavailable(false);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => controller.abort();
  }, [rangeEnd, rangeStart]);

  function shiftWeek(direction: "prev" | "next") {
    setCurrentWeek((week) => direction === "prev" ? subWeeks(week, 1) : addWeeks(week, 1));
  }

  function resetToCurrentWeek() {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  function handleEntryCreated(entry: TimeEntry) {
    setSnapshot((current) => {
      if (!current) return current;

      const durationMinutes = secondsToMinutes(entry.duration ?? 0);
      const updatedTasks = current.taskOptions.map((task) =>
        task.id === entry.taskId
          ? { ...task, actualTime: (task.actualTime ?? 0) + durationMinutes }
          : task
      );

      return buildAnalyticsSnapshot({
        tasks: updatedTasks,
        timeEntries: [entry, ...current.timeEntries],
        rangeStart: current.rangeStart,
        rangeEnd: current.rangeEnd,
      });
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleTimeEntryCreated = (event: Event) => {
      const entry = (event as CustomEvent<TimeEntry>).detail;
      if (!entry) return;
      handleEntryCreated(entry);
    };

    window.addEventListener(TIME_ENTRY_CREATED_EVENT, handleTimeEntryCreated as EventListener);
    return () => {
      window.removeEventListener(
        TIME_ENTRY_CREATED_EVENT,
        handleTimeEntryCreated as EventListener
      );
    };
  }, []);

  const totalPlannedMinutes = snapshot?.summary.totalPlannedMinutes ?? 0;
  const totalActualMinutes = snapshot?.summary.totalActualMinutes ?? 0;
  const alignmentRate =
    totalPlannedMinutes > 0
      ? Math.round((totalActualMinutes / totalPlannedMinutes) * 100)
      : totalActualMinutes > 0
        ? 100
        : 0;
  const planDelta = totalActualMinutes - totalPlannedMinutes;
  const activeDays = snapshot ? getActiveDays(snapshot) : 0;
  const bestDay = snapshot ? getBestDay(snapshot) : null;
  const averageSessionMinutes =
    snapshot && snapshot.summary.trackedEntries > 0
      ? totalActualMinutes / snapshot.summary.trackedEntries
      : 0;
  const alignmentTone =
    totalPlannedMinutes === 0
      ? "neutral"
      : alignmentRate >= 95 && alignmentRate <= 115
        ? "success"
        : alignmentRate >= 70
          ? "warning"
          : "danger";

  return (
    <div className="workspace-page analytics-workspace-page">
      <div className="workspace-page__header">
        <div className="workspace-page__intro">
          <p className="workspace-page__eyebrow">Analytics</p>
          <h1 className="workspace-page__title workspace-page__title--wide">
            Fokuszeit, Planqualitaet und Wochenrhythmus
          </h1>
          <p className="workspace-page__copy">
            Ein ruhiger Wochenblick auf Fokusbloecke, Erledigungsquote und die Verteilung
            deiner Arbeit ueber Channels und Tage. Die Analytics-Seite fuehlt sich jetzt
            wie ein eigener Raum innerhalb der App an.
          </p>

          <div className="workspace-page__meta">
            <StatusPill label={weekLabel} />
            {!loading && snapshot ? (
              <>
                <StatusPill label={`${snapshot.summary.totalTasks} Aufgaben im Blick`} />
                <StatusPill label={`${snapshot.summary.trackedEntries} Sessions`} tone="accent" />
                <StatusPill label={`${alignmentRate}% Planabgleich`} tone={alignmentTone} />
              </>
            ) : null}
          </div>
        </div>

        <div className="workspace-page__actions analytics-toolbar">
          <button
            type="button"
            onClick={() => shiftWeek("prev")}
            className="workspace-button h-11 w-11 px-0"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft size={17} />
          </button>

          <button
            type="button"
            onClick={resetToCurrentWeek}
            className="workspace-button px-5 md:px-6"
          >
            Diese Woche
          </button>

          <button
            type="button"
            onClick={() => shiftWeek("next")}
            className="workspace-button h-11 w-11 px-0"
            aria-label="Naechste Woche"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="workspace-page__scroll">
        {loading ? (
          <div className="workspace-page__content workspace-page__content--wide">
            <div className="workspace-note flex items-center gap-3">
              <LoaderCircle size={16} className="animate-spin" />
              Analytics werden geladen
            </div>
          </div>
        ) : error || !snapshot ? (
          <div className="workspace-page__content workspace-page__content--wide">
            <div className="workspace-empty min-h-[320px]">
              {error ?? "Keine Analytics verfuegbar."}
            </div>
          </div>
        ) : (
          <div className="workspace-page__content workspace-page__content--wide">
            <div className="workspace-page__stack analytics-page-stack">
                {apiUnavailable && (
                  <div className="workspace-note">
                    Datenbank gerade nicht erreichbar. Das Dashboard zeigt den API-Fallback.
                  </div>
                )}

                <HeroSummaryCard
                  weekLabel={weekLabel}
                  actualMinutes={totalActualMinutes}
                  plannedMinutes={totalPlannedMinutes}
                  alignmentRate={alignmentRate}
                  averageSessionMinutes={averageSessionMinutes}
                />

                <div className="analytics-stat-grid">
                  <StatCard
                    icon={<BarChart3 size={18} />}
                    label="Getrackte Zeit"
                    value={formatCompactMinutes(totalActualMinutes)}
                    detail={
                      totalPlannedMinutes > 0
                        ? `${formatDelta(planDelta)} gegenueber deinem Plan`
                        : `${snapshot.summary.trackedEntries} Sessions im Zeitraum`
                    }
                  />
                  <StatCard
                    icon={<Target size={18} />}
                    label="Erledigungsquote"
                    value={`${snapshot.summary.completionRate}%`}
                    detail={`${snapshot.summary.completedTasks} von ${snapshot.summary.totalTasks} Aufgaben abgeschlossen`}
                  />
                  <StatCard
                    icon={<Flame size={18} />}
                    label="Planungs-Streak"
                    value={`${snapshot.summary.streak} Tage`}
                    detail="Aufeinanderfolgende Tage mit geplanter Tagesliste"
                  />
                  <StatCard
                    icon={<LayoutGrid size={18} />}
                    label="Top Channel"
                    value={snapshot.summary.mostUsedChannel ?? "Noch offen"}
                    detail="Meistgenutzter Channel nach Fokuszeit"
                  />
                </div>

                <div className="analytics-insight-grid">
                  <InsightCard
                    eyebrow="Bester Tag"
                    value={bestDay && bestDay.actualMinutes > 0 ? bestDay.label : "Noch offen"}
                    label="Staerkster Fokuspunkt"
                    detail={
                      bestDay && bestDay.actualMinutes > 0
                        ? `${formatCompactMinutes(bestDay.actualMinutes)} getrackte Zeit`
                        : "Noch kein Tag mit nennenswerter Fokuszeit."
                    }
                  />
                  <InsightCard
                    eyebrow="Session-Schnitt"
                    value={averageSessionMinutes > 0 ? formatCompactMinutes(averageSessionMinutes) : "0s"}
                    label="Durchschnitt pro Eintrag"
                    detail={`${snapshot.summary.trackedEntries} Sessions im gewaehlten Zeitraum`}
                  />
                  <InsightCard
                    eyebrow="Aktive Tage"
                    value={`${activeDays}/7`}
                    label="Rhythmus ueber die Woche"
                    detail={`${Math.round((activeDays / 7) * 100)}% der Woche zeigen Planung oder Tracking`}
                  />
                </div>

                <SurfaceCard
                  eyebrow="Weekly Split"
                  title="Zeitverteilung nach Channels"
                  copy="Die groesste Ansicht der Seite. Hier bekommt jeder Channel genug Platz, damit Namen, Vergleich und Farben sauber lesbar bleiben."
                  action={
                    <span className="workspace-badge">
                      Geplant vs. tatsaechlich
                    </span>
                  }
                >
                  <div className="workspace-surface workspace-surface--soft analytics-chart-panel p-4 md:p-5">
                    <div className="h-[330px] md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={snapshot.channels} barGap={10}>
                          <CartesianGrid stroke="rgba(233, 225, 215, 0.75)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: "#8d857b", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={axisTick}
                            tick={{ fill: "#b2aaa1", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="plannedMinutes" name="Geplant" radius={[12, 12, 0, 0]} fill="#e9e2d9" />
                          <Bar dataKey="actualMinutes" name="Getrackt" radius={[12, 12, 0, 0]}>
                            {snapshot.channels.map((channel) => (
                              <Cell key={channel.channelId} fill={channel.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </SurfaceCard>

                <div className="analytics-chart-grid">
                  <SurfaceCard
                    eyebrow="Daily Rhythm"
                    title="Taegliche Arbeitszeit"
                    copy="Die Linie zeigt, an welchen Tagen sich deine Fokuszeit wirklich verdichtet."
                  >
                    <div className="workspace-surface workspace-surface--soft analytics-chart-panel p-4 md:p-5">
                      <div className="h-[280px] md:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={snapshot.daily}>
                            <CartesianGrid stroke="rgba(233, 225, 215, 0.75)" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: "#8d857b", fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={axisTick}
                              tick={{ fill: "#b2aaa1", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={42}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Line
                              type="monotone"
                              dataKey="actualMinutes"
                              name="Getrackt"
                              stroke="#f0a654"
                              strokeWidth={3}
                              dot={{ r: 4, fill: "#f0a654" }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard
                    eyebrow="Daily Delta"
                    title="Geplant vs. tatsaechlich"
                    copy="Hier siehst du schneller, welche Tage stabil geplant waren und wo die Woche gekippt ist."
                  >
                    <div className="workspace-surface workspace-surface--soft analytics-chart-panel p-4 md:p-5">
                      <div className="h-[280px] md:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={snapshot.daily} barGap={10}>
                            <CartesianGrid stroke="rgba(233, 225, 215, 0.75)" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: "#8d857b", fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={axisTick}
                              tick={{ fill: "#b2aaa1", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={42}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="plannedMinutes" name="Geplant" radius={[10, 10, 0, 0]} fill="#ddd5cb" />
                            <Bar dataKey="actualMinutes" name="Getrackt" radius={[10, 10, 0, 0]} fill="#8d7cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </SurfaceCard>
                </div>

                <TimeTrackingPanel
                  tasks={snapshot.taskOptions}
                  entries={snapshot.timeEntries}
                />

                <SurfaceCard
                  eyebrow="Highlights"
                  title="Meistgenutzte Channels"
                  copy="Die wichtigsten Channel der Woche mit genug Breite fuer Namen, Zeit und Kontext."
                >
                  <div className="analytics-channel-grid">
                    {snapshot.topChannels.length > 0 ? (
                      snapshot.topChannels.map((channel, index) => (
                        <div
                          key={channel.channelId}
                          className={`workspace-list-item p-5 ${index === 0 ? "workspace-surface--warning" : ""}`}
                          style={{
                            backgroundColor: index === 0 ? "rgba(255, 247, 235, 0.95)" : undefined,
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: channel.color }}
                            />
                            <p
                              className="truncate text-[14px] font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {channel.name}
                            </p>
                          </div>
                          <p
                            className="mt-5 text-[28px] font-semibold tracking-[-0.055em]"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {formatCompactMinutes(channel.actualMinutes)}
                          </p>
                          <p className="mt-4 text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
                            {channel.taskCount} Aufgaben, {formatCompactMinutes(channel.plannedMinutes)} geplant
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="workspace-empty">
                        Noch keine Channel-Verteilung fuer diese Woche.
                      </div>
                    )}
                  </div>
                </SurfaceCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

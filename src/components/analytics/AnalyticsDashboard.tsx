"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
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
import type { AnalyticsSnapshot, TimeEntry } from "@/types";
import TimeTrackingPanel from "@/components/analytics/TimeTrackingPanel";

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function axisTick(minutes: number) {
  if (minutes <= 0) return "0h";
  return `${Math.round(minutes / 60)}h`;
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
    <div className="planning-card">
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
              {formatMinutes(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={wide ? "analytics-section analytics-section--wide" : "analytics-section"}>
      <h2 className="planning-column__title">{title}</h2>
      <p className="planning-column__date">{subtitle}</p>
      <div className="analytics-section__body">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="analytics-stat">
      <p className="analytics-stat__label">{label}</p>
      <p className="analytics-stat__value">{value}</p>
      <p className="analytics-stat__detail">{detail}</p>
    </div>
  );
}

const chartGrid = "#f1ebe4";
const axisProps = {
  axisLine: false,
  tickLine: false,
} as const;

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

      const durationMinutes = Math.max(1, Math.round((entry.duration ?? 0) / 60));
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

  return (
    <div className="workspace-page">
      <div className="planning-toolbar">
        <div className="planning-toolbar__group planning-toolbar__group--nav">
          <button
            type="button"
            onClick={() => shiftWeek("prev")}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button type="button" onClick={resetToCurrentWeek} className="planning-toolbar__button">
            <CalendarDays size={14} strokeWidth={2} />
            {weekLabel}
          </button>
          <button
            type="button"
            onClick={() => shiftWeek("next")}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Naechste Woche"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
        <span className="settings-toolbar__title">Analytics</span>
      </div>

      <div className="workspace-page__scroll">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="workspace-badge">
              <LoaderCircle size={14} className="animate-spin" />
              Analytics werden geladen
            </span>
          </div>
        ) : error || !snapshot ? (
          <div className="flex h-full items-center justify-center">
            <span className="workspace-badge">{error ?? "Keine Analytics verfuegbar."}</span>
          </div>
        ) : (
          <div className="analytics-page">
            {apiUnavailable && (
              <p className="analytics-notice">
                Datenbank gerade nicht erreichbar. Das Dashboard zeigt den API-Fallback.
              </p>
            )}

            <div className="analytics-stats">
              <Stat
                label="Getrackte Zeit"
                value={formatMinutes(snapshot.summary.totalActualMinutes)}
                detail={`${snapshot.summary.trackedEntries} Sessions im Zeitraum`}
              />
              <Stat
                label="Erledigungsquote"
                value={`${snapshot.summary.completionRate}%`}
                detail={`${snapshot.summary.completedTasks} von ${snapshot.summary.totalTasks} Aufgaben`}
              />
              <Stat
                label="Planungs-Streak"
                value={`${snapshot.summary.streak} ${snapshot.summary.streak === 1 ? "Tag" : "Tage"}`}
                detail="Tage in Folge mit Tagesplan"
              />
              <Stat
                label="Top Channel"
                value={snapshot.summary.mostUsedChannel ?? "Noch offen"}
                detail="Meiste Fokuszeit"
              />
            </div>

            <div className="analytics-columns">
              <AnalyticsSection title="Channels" subtitle="Geplant vs. getrackt" wide>
                <div className="analytics-chart analytics-chart--tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.channels} barGap={6}>
                      <CartesianGrid stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#8d857b", fontSize: 12 }} {...axisProps} />
                      <YAxis tickFormatter={axisTick} tick={{ fill: "#b2aaa1", fontSize: 11 }} width={36} {...axisProps} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244, 239, 232, 0.6)" }} />
                      <Bar dataKey="plannedMinutes" name="Geplant" radius={[4, 4, 0, 0]} fill="#e4dfd8" />
                      <Bar dataKey="actualMinutes" name="Getrackt" radius={[4, 4, 0, 0]}>
                        {snapshot.channels.map((channel) => (
                          <Cell key={channel.channelId} fill={channel.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                title="Zeiterfassung"
                subtitle={`${snapshot.timeEntries.length} Eintraege diese Woche`}
              >
                <TimeTrackingPanel
                  tasks={snapshot.taskOptions}
                  entries={snapshot.timeEntries}
                  onEntryCreated={handleEntryCreated}
                />
              </AnalyticsSection>

              <AnalyticsSection title="Arbeitszeit" subtitle="Getrackt pro Tag">
                <div className="analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshot.daily}>
                      <CartesianGrid stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#8d857b", fontSize: 12 }} {...axisProps} />
                      <YAxis tickFormatter={axisTick} tick={{ fill: "#b2aaa1", fontSize: 11 }} width={36} {...axisProps} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="actualMinutes"
                        name="Getrackt"
                        stroke="#f0a654"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#f0a654" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsSection>

              <AnalyticsSection title="Tagesbilanz" subtitle="Geplant vs. getrackt">
                <div className="analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.daily} barGap={4}>
                      <CartesianGrid stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#8d857b", fontSize: 12 }} {...axisProps} />
                      <YAxis tickFormatter={axisTick} tick={{ fill: "#b2aaa1", fontSize: 11 }} width={36} {...axisProps} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(244, 239, 232, 0.6)" }} />
                      <Bar dataKey="plannedMinutes" name="Geplant" radius={[4, 4, 0, 0]} fill="#e4dfd8" />
                      <Bar dataKey="actualMinutes" name="Getrackt" radius={[4, 4, 0, 0]} fill="#8d7cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsSection>

              <AnalyticsSection title="Top Channels" subtitle="Nach Fokuszeit">
                {snapshot.topChannels.length > 0 ? (
                  snapshot.topChannels.map((channel) => (
                    <div key={channel.channelId} className="settings-row settings-row--inline">
                      <div className="settings-row__text">
                        <p className="settings-row__label flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: channel.color }}
                          />
                          <span className="truncate">{channel.name}</span>
                        </p>
                        <p className="settings-row__description">
                          {channel.taskCount} Aufgaben, {formatMinutes(channel.plannedMinutes)} geplant
                        </p>
                      </div>
                      <span className="planning-card__duration">
                        {formatMinutes(channel.actualMinutes)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="settings-row__description">
                    Noch keine Channel-Verteilung fuer diese Woche.
                  </p>
                )}
              </AnalyticsSection>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

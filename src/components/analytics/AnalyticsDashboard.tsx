"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
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
  TIME_ENTRY_CREATED_EVENT,
} from "@/lib/time-tracking";
import type { AnalyticsSnapshot, TimeEntry } from "@/types";
import TimeTrackingPanel from "@/components/analytics/TimeTrackingPanel";

const COLOR_PRIMARY = "var(--text-primary)";
const COLOR_SECONDARY = "var(--text-secondary)";
const COLOR_MUTED = "var(--text-muted)";
const COLOR_ACCENT = "var(--accent-primary)";
const CARD_BORDER = "1px solid #e4ddd6";
const CARD_BG = "#ffffff";
const CARD_SHADOW = "0 1px 0 rgba(89, 72, 48, 0.04)";
const RULE = "1px solid #efe8e0";

const inner: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  padding: "28px 28px 40px",
  display: "flex",
  flexDirection: "column",
  gap: 26,
};

const cardBase: CSSProperties = {
  border: CARD_BORDER,
  borderRadius: 8,
  background: CARD_BG,
  boxShadow: CARD_SHADOW,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 24,
  paddingBottom: 4,
  borderBottom: RULE,
};

const titleStyle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 36,
  fontWeight: 800,
  lineHeight: 0.96,
  letterSpacing: "-0.065em",
};

const dateStyle: CSSProperties = {
  marginTop: 8,
  color: COLOR_SECONDARY,
  fontSize: 15,
  letterSpacing: "-0.025em",
};

const pillsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  paddingBottom: 10,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(244, 239, 232, 0.85)",
  color: COLOR_SECONDARY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const statsRow: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
};

const statTile: CSSProperties = {
  ...cardBase,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "16px 18px",
};

const statLabel: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const statValue: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 26,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.045em",
};

const statValueText: CSSProperties = {
  ...statValue,
  fontSize: 19,
  lineHeight: 1.15,
  letterSpacing: "-0.03em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statUnit: CSSProperties = {
  marginLeft: 4,
  color: COLOR_MUTED,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const statHint: CSSProperties = {
  marginTop: 2,
  color: COLOR_SECONDARY,
  fontSize: 12,
  lineHeight: 1.45,
};

const block: CSSProperties = {
  ...cardBase,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "20px 22px 22px",
};

const blockHeader: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 14,
};

const blockTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const blockHint: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "-0.015em",
};

const grid2: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const channelRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 4px",
  borderTop: "1px solid #f1ebe4",
};

const channelName: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.025em",
};

const channelMeta: CSSProperties = {
  marginTop: 2,
  color: COLOR_MUTED,
  fontSize: 12,
};

const channelValue: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const noteStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 16px",
  border: CARD_BORDER,
  borderRadius: 8,
  background: CARD_BG,
  color: COLOR_SECONDARY,
  fontSize: 13,
};

const toolbarDateStyle: CSSProperties = {
  color: COLOR_SECONDARY,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const boardStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  flexDirection: "column",
  background: "#fffdfa",
};

const scrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  background: "#fffdfa",
};

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
      style={{
        padding: "10px 12px",
        border: CARD_BORDER,
        borderRadius: 8,
        background: "rgba(255, 253, 250, 0.98)",
        boxShadow: "0 8px 18px rgba(89, 72, 48, 0.08)",
      }}
    >
      <p style={{ color: COLOR_PRIMARY, fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
        {payload.map((item) => (
          <div
            key={item.name}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
          >
            <span
              style={{
                height: 8,
                width: 8,
                borderRadius: 999,
                backgroundColor: item.color ?? COLOR_ACCENT,
              }}
            />
            <span style={{ color: COLOR_SECONDARY }}>{item.name}</span>
            <span style={{ marginLeft: "auto", color: COLOR_PRIMARY, fontWeight: 600 }}>
              {formatCompactMinutes(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section style={block}>
      <header style={blockHeader}>
        <h2 style={blockTitle}>{title}</h2>
        {hint && <span style={blockHint}>{hint}</span>}
      </header>
      {children}
    </section>
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
  const weekLabel = `${format(currentWeek, "d. MMM", { locale: de })} – ${format(
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
    setCurrentWeek((week) =>
      direction === "prev" ? subWeeks(week, 1) : addWeeks(week, 1)
    );
  }

  function resetToCurrentWeek() {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  function handleEntryCreated(entry: TimeEntry) {
    setSnapshot((current) => {
      if (!current) return current;

      const dedupedEntries = [
        entry,
        ...current.timeEntries.filter((existingEntry) => existingEntry.id !== entry.id),
      ];

      return buildAnalyticsSnapshot({
        tasks: current.taskOptions,
        timeEntries: dedupedEntries,
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

  return (
    <section className="planning-board" style={boardStyle}>
      <div className="planning-toolbar">
        <div className="planning-toolbar__group planning-toolbar__group--nav">
          <button
            type="button"
            onClick={() => shiftWeek("prev")}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={resetToCurrentWeek}
            className="planning-toolbar__button"
          >
            <CalendarDays size={15} strokeWidth={1.9} />
            Diese Woche
          </button>

          <button
            type="button"
            onClick={() => shiftWeek("next")}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Nächste Woche"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>

        <span style={toolbarDateStyle}>{weekLabel}</span>
      </div>

      <div style={scrollStyle}>
        <div style={inner}>
          {loading ? (
            <div style={noteStyle}>
              <LoaderCircle size={14} className="animate-spin" />
              Analytics werden geladen
            </div>
          ) : error || !snapshot ? (
            <div style={noteStyle}>
              {error ?? "Keine Analytics verfügbar."}
            </div>
          ) : (
            <>
              <header style={headerStyle}>
                <div>
                  <h1 style={titleStyle}>Analytics</h1>
                  <p style={dateStyle}>{weekLabel}</p>
                </div>
                <div style={pillsRow}>
                  <span style={pillStyle}>{snapshot.summary.totalTasks} Aufgaben</span>
                  <span style={pillStyle}>{snapshot.summary.trackedEntries} Sessions</span>
                  <span style={pillStyle}>{alignmentRate}% Plan</span>
                </div>
              </header>

              {apiUnavailable && (
                <div style={noteStyle}>
                  Datenbank gerade nicht erreichbar – Anzeige aus dem API-Fallback.
                </div>
              )}

              <div style={statsRow}>
                <article style={statTile}>
                  <p style={statLabel}>Getrackt</p>
                  <p style={statValue}>{formatCompactMinutes(totalActualMinutes)}</p>
                  <p style={statHint}>
                    {totalPlannedMinutes > 0
                      ? `${formatDelta(planDelta)} ggü. Plan`
                      : `${snapshot.summary.trackedEntries} Sessions`}
                  </p>
                </article>

                <article style={statTile}>
                  <p style={statLabel}>Erledigt</p>
                  <p style={statValue}>{snapshot.summary.completionRate}%</p>
                  <p style={statHint}>
                    {snapshot.summary.completedTasks} / {snapshot.summary.totalTasks} Aufgaben
                  </p>
                </article>

                <article style={statTile}>
                  <p style={statLabel}>Streak</p>
                  <p style={statValue}>
                    {snapshot.summary.streak}
                    <span style={statUnit}>Tage</span>
                  </p>
                  <p style={statHint}>Aufeinanderfolgend geplant</p>
                </article>

                <article style={statTile}>
                  <p style={statLabel}>Top Channel</p>
                  <p style={statValueText} title={snapshot.summary.mostUsedChannel ?? undefined}>
                    {snapshot.summary.mostUsedChannel ?? "—"}
                  </p>
                  <p style={statHint}>Meiste Fokuszeit</p>
                </article>
              </div>

              <Block title="Zeit nach Channels" hint="Geplant vs. tatsächlich">
                <div style={{ height: 320, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.channels} barGap={8}>
                      <CartesianGrid stroke="rgba(233, 225, 215, 0.7)" vertical={false} />
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
                        width={38}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "rgba(244, 239, 232, 0.4)" }}
                      />
                      <Bar dataKey="plannedMinutes" name="Geplant" radius={[4, 4, 0, 0]} fill="#ece6dd" />
                      <Bar dataKey="actualMinutes" name="Getrackt" radius={[4, 4, 0, 0]}>
                        {snapshot.channels.map((channel) => (
                          <Cell key={channel.channelId} fill={channel.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Block>

              <div style={grid2}>
                <Block
                  title="Täglicher Rhythmus"
                  hint={
                    bestDay && bestDay.actualMinutes > 0
                      ? `Bester Tag: ${bestDay.label}`
                      : "Noch kein Tag"
                  }
                >
                  <div style={{ height: 240, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={snapshot.daily}>
                        <CartesianGrid stroke="rgba(233, 225, 215, 0.7)" vertical={false} />
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
                          width={38}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ stroke: "rgba(141, 124, 246, 0.25)", strokeWidth: 1 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actualMinutes"
                          name="Getrackt"
                          stroke="#8d7cf6"
                          strokeWidth={2.4}
                          dot={{ r: 3, fill: "#8d7cf6", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Block>

                <Block title="Geplant vs. getrackt" hint={`${activeDays}/7 aktive Tage`}>
                  <div style={{ height: 240, width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.daily} barGap={6}>
                        <CartesianGrid stroke="rgba(233, 225, 215, 0.7)" vertical={false} />
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
                          width={38}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ fill: "rgba(244, 239, 232, 0.4)" }}
                        />
                        <Bar dataKey="plannedMinutes" name="Geplant" radius={[4, 4, 0, 0]} fill="#ece6dd" />
                        <Bar dataKey="actualMinutes" name="Getrackt" radius={[4, 4, 0, 0]} fill="#8d7cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Block>
              </div>

              <TimeTrackingPanel
                tasks={snapshot.taskOptions}
                entries={snapshot.timeEntries}
              />

              {snapshot.topChannels.length > 0 && (
                <Block title="Top Channels" hint="Nach getrackter Zeit">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {snapshot.topChannels.map((channel, index) => (
                      <div
                        key={channel.channelId}
                        style={{ ...channelRow, borderTop: index === 0 ? "0" : "1px solid #f1ebe4" }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            height: 10,
                            width: 10,
                            borderRadius: 999,
                            backgroundColor: channel.color,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={channelName}>{channel.name}</p>
                          <p style={channelMeta}>
                            {channel.taskCount} Aufgaben · {formatCompactMinutes(channel.plannedMinutes)} geplant
                          </p>
                        </div>
                        <p style={channelValue}>
                          {formatCompactMinutes(channel.actualMinutes)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Block>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

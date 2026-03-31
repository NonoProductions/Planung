import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/server-auth";
import {
  createDbUnavailableResponse,
  isDatabaseUnavailableError,
} from "@/lib/api-db-error";

// ----- Recurring event expansion -----

interface RecurringRule {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  endDate?: string;
  daysOfWeek?: number[]; // 0=Sun … 6=Sat
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  color: string | null;
  isRecurring: boolean;
  recurringRule: unknown;
  calendarCategoryId: string | null;
}

function expandRecurring(
  event: EventRow,
  rangeStart: Date,
  rangeEnd: Date
): EventRow[] {
  const rule = event.recurringRule as RecurringRule;
  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  const results: EventRow[] = [];

  // Hard limit to avoid runaway loops
  const ruleEnd = rule.endDate ? new Date(rule.endDate) : new Date("2030-12-31");
  const effectiveEnd = ruleEnd < rangeEnd ? ruleEnd : rangeEnd;

  const makeOccurrence = (start: Date): EventRow => ({
    ...event,
    id: `${event.id}_${start.getTime()}`,
    startTime: new Date(start),
    endTime: new Date(start.getTime() + durationMs),
  });

  if (rule.frequency === "daily") {
    let cursor = new Date(event.startTime);
    const step = (rule.interval ?? 1) * 86_400_000;
    while (cursor <= effectiveEnd) {
      if (cursor >= rangeStart && cursor >= event.startTime) {
        results.push(makeOccurrence(cursor));
      }
      cursor = new Date(cursor.getTime() + step);
    }
  } else if (rule.frequency === "weekly") {
    const dows = rule.daysOfWeek;
    if (dows && dows.length > 0) {
      const eventWeekMs =
        Math.floor(event.startTime.getTime() / (7 * 86_400_000)) *
        (7 * 86_400_000);

      let day = new Date(
        Math.max(rangeStart.getTime(), event.startTime.getTime())
      );
      day.setHours(
        event.startTime.getHours(),
        event.startTime.getMinutes(),
        0,
        0
      );

      while (day <= effectiveEnd) {
        if (dows.includes(day.getDay())) {
          const dayWeekMs =
            Math.floor(day.getTime() / (7 * 86_400_000)) * (7 * 86_400_000);
          const weekDiff = Math.round(
            (dayWeekMs - eventWeekMs) / (7 * 86_400_000)
          );
          if (weekDiff >= 0 && weekDiff % (rule.interval ?? 1) === 0) {
            results.push(makeOccurrence(new Date(day)));
          }
        }
        day = new Date(day.getTime() + 86_400_000);
      }
    } else {
      let cursor = new Date(event.startTime);
      const step = (rule.interval ?? 1) * 7 * 86_400_000;
      while (cursor <= effectiveEnd) {
        if (cursor >= rangeStart) {
          results.push(makeOccurrence(cursor));
        }
        cursor = new Date(cursor.getTime() + step);
      }
    }
  } else if (rule.frequency === "monthly") {
    let cursor = new Date(event.startTime);
    while (cursor <= effectiveEnd) {
      if (cursor >= rangeStart) {
        results.push(makeOccurrence(cursor));
      }
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + (rule.interval ?? 1));
      cursor = next;
    }
  }

  return results;
}

function serializeEvent(e: EventRow) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    color: e.color,
    isRecurring: e.isRecurring,
    recurringRule: e.recurringRule ?? null,
    calendarCategoryId: e.calendarCategoryId,
  };
}

// GET /api/events?date=YYYY-MM-DD  OR  ?weekStart=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date");
    const weekStart = searchParams.get("weekStart");

    let rangeStart: Date;
    let rangeEnd: Date;

    if (weekStart) {
      rangeStart = new Date(weekStart);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 6);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (date) {
      rangeStart = new Date(date);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(date);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date();
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const { data: nonRecurring, error: e1 } = await supabase
      .from("CalendarEvent")
      .select("*")
      .eq("userId", userId)
      .eq("isRecurring", false)
      .gte("startTime", rangeStart.toISOString())
      .lte("startTime", rangeEnd.toISOString())
      .order("startTime", { ascending: true });

    if (e1) throw e1;

    const { data: recurring, error: e2 } = await supabase
      .from("CalendarEvent")
      .select("*")
      .eq("userId", userId)
      .eq("isRecurring", true)
      .lte("startTime", rangeEnd.toISOString());

    if (e2) throw e2;

    const toEventRow = (e: Record<string, unknown>): EventRow => ({
      id: e.id as string,
      title: e.title as string,
      description: e.description as string | null,
      startTime: new Date(e.startTime as string),
      endTime: new Date(e.endTime as string),
      color: e.color as string | null,
      isRecurring: e.isRecurring as boolean,
      recurringRule: e.recurringRule,
      calendarCategoryId: e.calendarCategoryId as string | null,
    });

    const expanded = (recurring ?? [])
      .map(toEventRow)
      .flatMap((e) => expandRecurring(e, rangeStart, rangeEnd));

    const all = [
      ...(nonRecurring ?? []).map(toEventRow).map(serializeEvent),
      ...expanded.map(serializeEvent),
    ].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return Response.json(all);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return createDbUnavailableResponse([]);
    }
    throw error;
  }
}

// POST /api/events
export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("CalendarEvent")
    .insert({
      id: crypto.randomUUID(),
      title: body.title,
      description: body.description || null,
      startTime: new Date(body.startTime).toISOString(),
      endTime: new Date(body.endTime).toISOString(),
      color: body.color || null,
      isRecurring: body.isRecurring ?? false,
      recurringRule: body.recurringRule || null,
      calendarCategoryId: body.calendarCategoryId || null,
      userId,
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return Response.json(data, { status: 201 });
}

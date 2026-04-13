import {
  eachDayOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { de } from "date-fns/locale";
import type {
  AnalyticsChannelPoint,
  AnalyticsDayPoint,
  AnalyticsSnapshot,
  AnalyticsTaskOption,
  TimeEntry,
} from "@/types";

function toDateOnly(value?: string) {
  return value ? value.slice(0, 10) : undefined;
}

function parseDateBoundary(value: string, end = false) {
  const date = parseISO(value);
  return end ? endOfDay(date) : startOfDay(date);
}

function safeMinutesFromEntry(entry: TimeEntry) {
  if (typeof entry.duration === "number" && Number.isFinite(entry.duration)) {
    return Math.max(0, entry.duration / 60);
  }

  if (entry.endTime) {
    const diff = parseISO(entry.endTime).getTime() - parseISO(entry.startTime).getTime();
    return Math.max(0, diff / 60000);
  }

  return 0;
}

function createChannelAccumulator(name: string, color: string): AnalyticsChannelPoint {
  return {
    channelId: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    color,
    plannedMinutes: 0,
    actualMinutes: 0,
    taskCount: 0,
  };
}

export function buildAnalyticsSnapshot(input: {
  tasks: AnalyticsTaskOption[];
  timeEntries: TimeEntry[];
  rangeStart: string;
  rangeEnd: string;
}): AnalyticsSnapshot {
  const { tasks, timeEntries, rangeStart, rangeEnd } = input;
  const start = parseDateBoundary(rangeStart);
  const end = parseDateBoundary(rangeEnd, true);

  const dayRows = eachDayOfInterval({ start, end }).map<AnalyticsDayPoint>((day) => ({
    date: format(day, "yyyy-MM-dd"),
    label: format(day, "EEE", { locale: de }),
    plannedMinutes: 0,
    actualMinutes: 0,
    completedTasks: 0,
    totalTasks: 0,
    completionRate: 0,
  }));

  const dayMap = new Map(dayRows.map((row) => [row.date, row]));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const channelMap = new Map<string, AnalyticsChannelPoint>();
  const trackedMinutesByTask = new Map<string, number>();

  for (const entry of timeEntries) {
    const startedAt = parseISO(entry.startTime);
    if (!isWithinInterval(startedAt, { start, end })) {
      continue;
    }

    const minutes = safeMinutesFromEntry(entry);
    const dayKey = format(startedAt, "yyyy-MM-dd");
    const task = taskMap.get(entry.taskId);
    const channelName = task?.channel?.name ?? "Ohne Channel";
    const channelColor = task?.channel?.color ?? "#C5BDB2";
    const channelKey = task?.channel?.id ?? channelName;

    trackedMinutesByTask.set(entry.taskId, (trackedMinutesByTask.get(entry.taskId) ?? 0) + minutes);

    const dayRow = dayMap.get(dayKey);
    if (dayRow) {
      dayRow.actualMinutes += minutes;
    }

    if (!channelMap.has(channelKey)) {
      channelMap.set(channelKey, {
        ...createChannelAccumulator(channelName, channelColor),
        channelId: channelKey,
      });
    }

    channelMap.get(channelKey)!.actualMinutes += minutes;
  }

  const relevantTasks = tasks.filter((task) => {
    const scheduledDate = task.scheduledDate ? parseDateBoundary(task.scheduledDate) : null;
    const completedAt = task.completedAt ? parseISO(task.completedAt) : null;

    return (
      trackedMinutesByTask.has(task.id) ||
      (scheduledDate ? isWithinInterval(scheduledDate, { start, end }) : false) ||
      (completedAt ? isWithinInterval(completedAt, { start, end }) : false)
    );
  });

  for (const task of relevantTasks) {
    const channelName = task.channel?.name ?? "Ohne Channel";
    const channelColor = task.channel?.color ?? "#C5BDB2";
    const channelKey = task.channel?.id ?? channelName;

    if (!channelMap.has(channelKey)) {
      channelMap.set(channelKey, {
        ...createChannelAccumulator(channelName, channelColor),
        channelId: channelKey,
      });
    }

    const channelRow = channelMap.get(channelKey)!;
    channelRow.taskCount += 1;

    if (task.plannedTime && task.scheduledDate) {
      const scheduledDay = dayMap.get(task.scheduledDate);
      if (scheduledDay) {
        scheduledDay.plannedMinutes += task.plannedTime;
        scheduledDay.totalTasks += 1;
        if (task.status === "COMPLETED") {
          scheduledDay.completedTasks += 1;
        }
      }

      channelRow.plannedMinutes += task.plannedTime;
    } else if (task.scheduledDate) {
      const scheduledDay = dayMap.get(task.scheduledDate);
      if (scheduledDay) {
        scheduledDay.totalTasks += 1;
        if (task.status === "COMPLETED") {
          scheduledDay.completedTasks += 1;
        }
      }
    }

    const trackedMinutes = trackedMinutesByTask.get(task.id) ?? 0;
    const remainingActualMinutes = Math.max((task.actualTime ?? 0) - trackedMinutes, 0);

    if (remainingActualMinutes > 0) {
      const fallbackDayKey =
        toDateOnly(task.completedAt) ??
        task.scheduledDate ??
        rangeStart;

      const dayRow = dayMap.get(fallbackDayKey);
      if (dayRow) {
        dayRow.actualMinutes += remainingActualMinutes;
      }

      channelRow.actualMinutes += remainingActualMinutes;
    }
  }

  for (const row of dayRows) {
    row.completionRate = row.totalTasks > 0
      ? Math.round((row.completedTasks / row.totalTasks) * 100)
      : 0;
  }

  const totalTasks = dayRows.reduce((sum, row) => sum + row.totalTasks, 0);
  const completedTasks = dayRows.reduce((sum, row) => sum + row.completedTasks, 0);
  const totalPlannedMinutes = dayRows.reduce((sum, row) => sum + row.plannedMinutes, 0);
  const totalActualMinutes = dayRows.reduce((sum, row) => sum + row.actualMinutes, 0);

  const planningDates = new Set(
    relevantTasks
      .map((task) => task.scheduledDate)
      .filter((value): value is string => Boolean(value))
  );

  let streak = 0;
  const streakAnchor = startOfDay(new Date()) > end ? end : startOfDay(new Date());
  let cursor = streakAnchor;
  const minimumCursor = subDays(start, 31);

  while (cursor >= minimumCursor) {
    const key = format(cursor, "yyyy-MM-dd");
    if (!planningDates.has(key)) {
      break;
    }
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  const channels = Array.from(channelMap.values()).sort((a, b) => {
    if (b.actualMinutes !== a.actualMinutes) {
      return b.actualMinutes - a.actualMinutes;
    }

    if (b.plannedMinutes !== a.plannedMinutes) {
      return b.plannedMinutes - a.plannedMinutes;
    }

    return b.taskCount - a.taskCount;
  });

  return {
    rangeStart,
    rangeEnd,
    summary: {
      totalPlannedMinutes,
      totalActualMinutes,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      streak,
      totalTasks,
      completedTasks,
      trackedEntries: timeEntries.length,
      mostUsedChannel: channels[0]?.name,
    },
    daily: dayRows,
    channels,
    topChannels: channels.slice(0, 3),
    taskOptions: tasks,
    timeEntries,
  };
}

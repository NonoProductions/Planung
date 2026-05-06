/**
 * Pomodoro split for timeboxed tasks.
 * 25 min work units. After each unit there is a short break, and after every
 * 4 completed units there is a long break (only between units, never trailing).
 */

export const POMODORO_WORK_MINUTES = 25;
export const POMODORO_SHORT_BREAK_MINUTES = 5;
export const POMODORO_LONG_BREAK_MINUTES = 25;
export const POMODOROS_PER_GROUP = 4;
export const POMODORO_BREAK_COLOR = "#94a3b8";
export const POMODORO_BREAK_TITLE = "🍅 Pause";

export interface PomodoroBlock {
  type: "work" | "break";
  /** Offset in minutes from the plan start */
  offsetMinutes: number;
  durationMinutes: number;
}

export interface PomodoroPlan {
  blocks: PomodoroBlock[];
  /** Total minutes the plan spans (work + breaks) */
  totalSpanMinutes: number;
  /** Just the breaks, for convenience */
  breaks: PomodoroBlock[];
}

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export function buildPomodoroPlan(totalWorkMinutes: number): PomodoroPlan {
  const work = Math.max(1, totalWorkMinutes);
  const fullUnits = Math.floor(work / POMODORO_WORK_MINUTES);
  const remainder = work - fullUnits * POMODORO_WORK_MINUTES;
  const totalUnits = fullUnits + (remainder > 0 ? 1 : 0);

  const blocks: PomodoroBlock[] = [];
  let cursor = 0;

  for (let i = 0; i < totalUnits; i++) {
    const isLastUnit = i === totalUnits - 1;
    const unitDuration =
      isLastUnit && remainder > 0 ? remainder : POMODORO_WORK_MINUTES;

    blocks.push({
      type: "work",
      offsetMinutes: cursor,
      durationMinutes: unitDuration,
    });
    cursor += unitDuration;

    if (!isLastUnit) {
      const completedAGroup = (i + 1) % POMODOROS_PER_GROUP === 0;
      const breakDuration = completedAGroup
        ? POMODORO_LONG_BREAK_MINUTES
        : POMODORO_SHORT_BREAK_MINUTES;

      blocks.push({
        type: "break",
        offsetMinutes: cursor,
        durationMinutes: breakDuration,
      });
      cursor += breakDuration;
    }
  }

  return {
    blocks,
    totalSpanMinutes: cursor,
    breaks: blocks.filter((block) => block.type === "break"),
  };
}

const BREAK_DESCRIPTION_PREFIX = "__pomodoro_break:";
const BREAK_DESCRIPTION_SUFFIX = "__";

export function buildPomodoroBreakDescription(taskId: string): string {
  return `${BREAK_DESCRIPTION_PREFIX}${taskId}${BREAK_DESCRIPTION_SUFFIX}`;
}

export function isPomodoroBreakEvent(event: {
  description?: string;
}): boolean {
  return Boolean(event.description?.startsWith(BREAK_DESCRIPTION_PREFIX));
}

export function getPomodoroBreakTaskId(event: {
  description?: string;
}): string | null {
  const description = event.description;
  if (!description?.startsWith(BREAK_DESCRIPTION_PREFIX)) return null;
  const rest = description.slice(BREAK_DESCRIPTION_PREFIX.length);
  if (!rest.endsWith(BREAK_DESCRIPTION_SUFFIX)) return null;
  return rest.slice(0, rest.length - BREAK_DESCRIPTION_SUFFIX.length);
}

export function buildWorkSegmentsFromBreaks(
  taskStartTime: string,
  taskEndTime: string,
  breakRanges: TimeRange[]
): TimeRange[] {
  const taskStart = new Date(taskStartTime).getTime();
  const taskEnd = new Date(taskEndTime).getTime();
  if (!Number.isFinite(taskStart) || !Number.isFinite(taskEnd) || taskEnd <= taskStart) {
    return [];
  }

  const normalizedBreaks = breakRanges
    .map((range) => {
      const start = new Date(range.startTime).getTime();
      const end = new Date(range.endTime).getTime();
      return { start, end };
    })
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
    .map((range) => ({
      start: Math.max(taskStart, range.start),
      end: Math.min(taskEnd, range.end),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (normalizedBreaks.length === 0) {
    return [{ startTime: taskStartTime, endTime: taskEndTime }];
  }

  const mergedBreaks: Array<{ start: number; end: number }> = [];
  for (const item of normalizedBreaks) {
    const previous = mergedBreaks[mergedBreaks.length - 1];
    if (!previous || item.start > previous.end) {
      mergedBreaks.push({ ...item });
      continue;
    }
    previous.end = Math.max(previous.end, item.end);
  }

  const segments: TimeRange[] = [];
  let cursor = taskStart;
  for (const item of mergedBreaks) {
    if (item.start > cursor) {
      segments.push({
        startTime: new Date(cursor).toISOString(),
        endTime: new Date(item.start).toISOString(),
      });
    }
    cursor = Math.max(cursor, item.end);
  }

  if (cursor < taskEnd) {
    segments.push({
      startTime: new Date(cursor).toISOString(),
      endTime: new Date(taskEnd).toISOString(),
    });
  }

  return segments;
}

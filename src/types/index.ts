export type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";

export interface Channel {
  id: string;
  name: string;
  color: string;
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
}

export type RecurringFrequency = "daily" | "weekly" | "monthly";
export type CelebrationType = "confetti" | "checkmark" | "fireworks";
export type CelebrationTrigger =
  | "all_tasks_complete"
  | "planning_ritual"
  | "shutdown_ritual";

export interface RecurringRule {
  frequency: RecurringFrequency;
  /** Repeat every N days/weeks/months (default 1) */
  interval?: number;
  /** Stop repeating after this ISO date */
  endDate?: string;
  /** For weekly: which days of week to repeat on (0=Sun...6=Sat) */
  daysOfWeek?: number[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  plannedTime?: number; // minutes
  actualTime?: number; // minutes, may be fractional
  scheduledDate?: string; // ISO date string
  scheduledStart?: string; // ISO datetime
  scheduledEnd?: string; // ISO datetime
  dueDate?: string;
  position: number;
  channelId?: string;
  channel?: Channel;
  subtasks?: Task[];
  isRecurring: boolean;
  isBacklog: boolean;
  backlogBucket?: string; // "this_week" | "next_weeks" | "someday"
  backlogFolder?: string;
  completedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  color?: string;
  isRecurring: boolean;
  recurringRule?: RecurringRule | null;
  calendarCategoryId?: string;
  calendarCategory?: CalendarCategory;
}

export interface TimeBlock {
  id: string;
  taskId: string;
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  isEvent: boolean; // true = calendar event, false = timeboxed task
}

export interface Objective {
  id: string;
  title: string;
  weekStart: string; // ISO date string (Monday of the week)
  progress: number; // 0-100
  userId?: string;
}

export interface Reflection {
  id: string;
  date: string; // ISO date string
  content: string;
  mood?: number;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  endTime?: string;
  duration?: number; // seconds
  status?: "running" | "completed";
}

export interface AnalyticsTaskOption {
  id: string;
  title: string;
  status: TaskStatus;
  plannedTime?: number;
  actualTime?: number;
  scheduledDate?: string;
  completedAt?: string;
  channel?: Channel;
}

export interface AnalyticsDayPoint {
  date: string;
  label: string;
  plannedMinutes: number;
  actualMinutes: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
}

export interface AnalyticsChannelPoint {
  channelId: string;
  name: string;
  color: string;
  plannedMinutes: number;
  actualMinutes: number;
  taskCount: number;
}

export interface AnalyticsSummary {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  completionRate: number;
  streak: number;
  totalTasks: number;
  completedTasks: number;
  trackedEntries: number;
  mostUsedChannel?: string;
}

export interface AnalyticsSnapshot {
  rangeStart: string;
  rangeEnd: string;
  summary: AnalyticsSummary;
  daily: AnalyticsDayPoint[];
  channels: AnalyticsChannelPoint[];
  topChannels: AnalyticsChannelPoint[];
  taskOptions: AnalyticsTaskOption[];
  timeEntries: TimeEntry[];
}

export type ThemeMode = "light" | "dark" | "system";

export type WeekStartPreference = "monday" | "sunday";

export type TimeFormatPreference = "24h" | "12h";

export type LanguagePreference = "de" | "en";

export type RolloverPosition = "top" | "bottom";

export type WorkloadDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface PlannerSettings {
  profile: {
    name: string;
    email: string;
    avatar: string;
  };
  display: {
    themeMode: ThemeMode;
    weekStart: WeekStartPreference;
    timeFormat: TimeFormatPreference;
    language: LanguagePreference;
  };
  planning: {
    planningTime: string;
    autoRollover: boolean;
    rolloverPosition: RolloverPosition;
  };
  workload: Record<WorkloadDay, number>;
  focus: {
    pomodoroMinutes: number;
    breakReminderMinutes: number;
    autoFocusOnTimerStart: boolean;
  };
  calendar: {
    defaultEventDuration: number;
  };
  celebrations: {
    enabled: boolean;
    type: CelebrationType;
  };
  notifications: {
    planningReminder: boolean;
    shutdownReminder: boolean;
    timerDone: boolean;
    taskDue: boolean;
  };
}

export interface PlannerExportData {
  exportedAt: string;
  settings: PlannerSettings;
  tasks: Task[];
  objectives: Objective[];
  events: CalendarEvent[];
  channels: Channel[];
  calendarCategories: CalendarCategory[];
}

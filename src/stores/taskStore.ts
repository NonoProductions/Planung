"use client";

import { create } from "zustand";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { Task, CalendarEvent, Channel, CalendarCategory, RecurringRule } from "@/types";
import { extractDateOnly } from "@/lib/date";
import { useUIStore } from "@/stores/uiStore";

// Placeholder channels (used as fallback when API unavailable)
const FALLBACK_CHANNELS: Channel[] = [
  { id: "ch1", name: "Arbeit", color: "#4F46E5" },
  { id: "ch2", name: "Persönlich", color: "#10B981" },
  { id: "ch3", name: "Studium", color: "#F59E0B" },
];

function mapApiTask(t: Record<string, unknown>): Task {
  return {
    id: t.id as string,
    title: t.title as string,
    description: (t.description as string) || undefined,
    status: t.status as Task["status"],
    plannedTime: (t.plannedTime as number) || undefined,
    actualTime: (t.actualTime as number) || undefined,
    scheduledDate: extractDateOnly(t.scheduledDate as string | undefined),
    scheduledStart: (t.scheduledStart as string) || undefined,
    scheduledEnd: (t.scheduledEnd as string) || undefined,
    dueDate: (t.dueDate as string) || undefined,
    position: (t.position as number) ?? 0,
    channelId: (t.channelId as string) || undefined,
    channel: t.channel
      ? {
          id: (t.channel as Record<string, unknown>).id as string,
          name: (t.channel as Record<string, unknown>).name as string,
          color: (t.channel as Record<string, unknown>).color as string,
        }
      : undefined,
    subtasks: Array.isArray(t.subtasks)
      ? (t.subtasks as Record<string, unknown>[])
          .map(mapApiTask)
          .sort((a, b) => a.position - b.position)
      : [],
    isRecurring: (t.isRecurring as boolean) ?? false,
    isBacklog: (t.isBacklog as boolean) ?? false,
    backlogBucket: (t.backlogBucket as string) || undefined,
    backlogFolder: (t.backlogFolder as string) || undefined,
    completedAt: (t.completedAt as string) || undefined,
  };
}

function mapApiEvent(e: Record<string, unknown>): CalendarEvent {
  return {
    id: e.id as string,
    title: e.title as string,
    description: (e.description as string) || undefined,
    startTime: e.startTime as string,
    endTime: e.endTime as string,
    color: (e.color as string) || undefined,
    isRecurring: (e.isRecurring as boolean) ?? false,
    recurringRule: (e.recurringRule as RecurringRule) || null,
    calendarCategoryId: (e.calendarCategoryId as string) || undefined,
    calendarCategory: e.calendarCategory
      ? {
          id: (e.calendarCategory as Record<string, unknown>).id as string,
          name: (e.calendarCategory as Record<string, unknown>).name as string,
          color: (e.calendarCategory as Record<string, unknown>).color as string,
        }
      : undefined,
  };
}

// Fallback calendar categories used when API is unavailable
const FALLBACK_CALENDAR_CATEGORIES: CalendarCategory[] = [
  { id: "cal1", name: "Persönlich", color: "#4F46E5" },
  { id: "cal2", name: "Arbeit", color: "#10B981" },
  { id: "cal3", name: "Familie", color: "#F59E0B" },
];

function findTaskInCollections(
  tasks: Task[],
  backlogTasks: Task[],
  taskId: string
) {
  return (
    tasks.find((task) => task.id === taskId) ??
    backlogTasks.find((task) => task.id === taskId)
  );
}

function clearTaskUiState(taskId: string) {
  const uiState = useUIStore.getState();

  if (uiState.selectedTaskId === taskId) {
    uiState.clearSelectedTask();
  }

  if (uiState.editingTaskId === taskId) {
    uiState.stopEditingTask();
  }

  if (uiState.focusTaskId === taskId) {
    uiState.closeFocusMode();
  }
}

function isTaskTreeCompleted(task: Task): boolean {
  return (
    task.status === "COMPLETED" &&
    (task.subtasks ?? []).every(isTaskTreeCompleted)
  );
}

function triggerDayCompletionCelebration(date: string, tasks: Task[]) {
  const scheduledTasks = tasks.filter(
    (task) => task.scheduledDate === date && !task.isBacklog
  );

  if (
    scheduledTasks.length === 0 ||
    !scheduledTasks.every(isTaskTreeCompleted)
  ) {
    return;
  }

  const label = format(parseISO(date), "EEEE, d. MMMM", { locale: de });
  const taskCountLabel =
    scheduledTasks.length === 1 ? "Task ist" : "Tasks sind";

  useUIStore.getState().triggerCelebration({
    trigger: "all_tasks_complete",
    title: `${label} geschafft`,
    subtitle: `${scheduledTasks.length} ${taskCountLabel} erledigt.`,
  });
}

interface TaskState {
  tasks: Task[];
  backlogTasks: Task[];
  events: CalendarEvent[];
  channels: Channel[];
  calendarCategories: CalendarCategory[];
  loading: boolean;
  backlogLoading: boolean;
  apiAvailable: boolean;

  // Data fetching
  fetchTasks: (date?: string) => Promise<void>;
  fetchBacklogTasks: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchEvents: (date?: string) => Promise<void>;
  fetchEventsForWeek: (weekStart: string) => Promise<void>;
  fetchCalendarCategories: () => Promise<void>;

  // Calendar category CRUD
  addCalendarCategory: (data: { name: string; color: string }) => Promise<void>;
  updateCalendarCategory: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteCalendarCategory: (id: string) => Promise<void>;

  // Task CRUD
  addTask: (task: {
    title: string;
    description?: string;
    plannedTime?: number;
    scheduledDate?: string;
    channelId?: string;
    position?: number;
    isBacklog?: boolean;
    backlogBucket?: string;
    backlogFolder?: string;
  }) => Promise<void>;
  updateTask: (
    taskId: string,
    updates: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "status"
        | "plannedTime"
        | "actualTime"
        | "scheduledDate"
        | "scheduledStart"
        | "scheduledEnd"
        | "position"
        | "channelId"
        | "isBacklog"
        | "backlogBucket"
        | "backlogFolder"
      >
    >
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskStatus: (taskId: string) => void;
  reorderTasks: (taskIds: string[]) => void;
  scheduleBacklogTask: (taskId: string, date: string) => Promise<void>;
  addSubtask: (parentId: string, title: string) => Promise<void>;
  toggleSubtaskStatus: (parentId: string, subtaskId: string) => Promise<void>;
  renameSubtask: (parentId: string, subtaskId: string, title: string) => Promise<void>;
  reorderSubtasks: (parentId: string, subtaskIds: string[]) => void;

  // Event CRUD
  addEvent: (event: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    color?: string;
    isRecurring?: boolean;
    recurringRule?: RecurringRule | null;
    calendarCategoryId?: string;
  }) => Promise<void>;
  updateEvent: (
    eventId: string,
    updates: Partial<Pick<CalendarEvent, "title" | "description" | "startTime" | "endTime" | "color" | "isRecurring" | "recurringRule" | "calendarCategoryId">>
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  backlogTasks: [],
  events: [],
  channels: FALLBACK_CHANNELS,
  calendarCategories: FALLBACK_CALENDAR_CATEGORIES,
  loading: false,
  backlogLoading: false,
  apiAvailable: true,

  fetchChannels: async () => {
    try {
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      set({ channels: data, apiAvailable: true });
    } catch {
      set({ channels: FALLBACK_CHANNELS, apiAvailable: false });
    }
  },

  fetchTasks: async (date?: string) => {
    set({ loading: true });
    try {
      const url = date ? `/api/tasks?date=${date}` : "/api/tasks";
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const tasks = (data as Record<string, unknown>[]).map(mapApiTask);
      set({
        tasks,
        loading: false,
        apiAvailable: res.headers.get("x-db-unavailable") !== "true",
      });
    } catch {
      set((state) => ({ loading: false, apiAvailable: false, tasks: state.tasks }));
    }
  },

  fetchBacklogTasks: async () => {
    set({ backlogLoading: true });
    try {
      const res = await fetch("/api/tasks?backlog=true");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const tasks = (data as Record<string, unknown>[]).map(mapApiTask);
      set({
        backlogTasks: tasks,
        backlogLoading: false,
        apiAvailable: res.headers.get("x-db-unavailable") !== "true",
      });
    } catch {
      set((state) => ({ backlogLoading: false, apiAvailable: false, backlogTasks: state.backlogTasks }));
    }
  },

  fetchEvents: async (date?: string) => {
    try {
      const url = date ? `/api/events?date=${date}` : "/api/events";
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const events = (data as Record<string, unknown>[]).map(mapApiEvent);
      set({ events, apiAvailable: true });
    } catch {
      set((state) => ({ apiAvailable: false, events: state.events }));
    }
  },

  fetchEventsForWeek: async (weekStart: string) => {
    try {
      const res = await fetch(`/api/events?weekStart=${weekStart}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const events = (data as Record<string, unknown>[]).map(mapApiEvent);
      set({ events, apiAvailable: true });
    } catch {
      set((state) => ({ apiAvailable: false, events: state.events }));
    }
  },

  fetchCalendarCategories: async () => {
    try {
      const res = await fetch("/api/calendars");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      set({
        calendarCategories: (data as { id: string; name: string; color: string }[]),
        apiAvailable: true,
      });
    } catch {
      set({ calendarCategories: FALLBACK_CALENDAR_CATEGORIES, apiAvailable: false });
    }
  },

  addCalendarCategory: async (data) => {
    const state = get();
    if (state.apiAvailable) {
      try {
        const res = await fetch("/api/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("API error");
        const created = await res.json();
        set((s) => ({ calendarCategories: [...s.calendarCategories, created] }));
        return;
      } catch { /* fall through */ }
    }
    // Local fallback
    const local: CalendarCategory = { id: `local-cal-${Date.now()}`, ...data };
    set((s) => ({ calendarCategories: [...s.calendarCategories, local] }));
  },

  updateCalendarCategory: async (id, updates) => {
    // Optimistic
    set((s) => ({
      calendarCategories: s.calendarCategories.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
    const state = get();
    if (state.apiAvailable) {
      try {
        await fetch(`/api/calendars/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch { /* optimistic already applied */ }
    }
  },

  deleteCalendarCategory: async (id) => {
    set((s) => ({ calendarCategories: s.calendarCategories.filter((c) => c.id !== id) }));
    const state = get();
    if (state.apiAvailable) {
      try {
        await fetch(`/api/calendars/${id}`, { method: "DELETE" });
      } catch { /* already removed locally */ }
    }
  },

  addTask: async (taskData) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const newTask = mapApiTask(data as Record<string, unknown>);
      set({ apiAvailable: true });
      if (taskData.isBacklog) {
        set((s) => ({ backlogTasks: [...s.backlogTasks, newTask] }));
      } else {
        set((s) => ({ tasks: [...s.tasks, newTask] }));
      }
    } catch {
      set({ apiAvailable: false });
    }
  },

  updateTask: async (taskId, updates) => {
    const state = get();
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(updates, key);
    const currentTask = findTaskInCollections(
      state.tasks,
      state.backlogTasks,
      taskId
    );
    const celebrationDate =
      updates.scheduledDate ?? currentTask?.scheduledDate;

    const applyUpdate = (t: Task): Task => {
      if (t.id !== taskId) return t;
      const updated = { ...t, ...updates };
      if (updates.status === "COMPLETED") {
        updated.completedAt = new Date().toISOString();
      } else if (updates.status) {
        updated.completedAt = undefined;
      }
      if (hasOwn("channelId")) {
        updated.channel = state.channels.find(
          (c) => c.id === updates.channelId
        );
      }
      return updated;
    };

    // Optimistic update — apply to both lists
    set((s) => ({
      tasks: s.tasks.map(applyUpdate),
      backlogTasks: s.backlogTasks.map(applyUpdate),
    }));

    // If moving from backlog to scheduled, transfer between lists
    if (updates.isBacklog === false) {
      set((s) => {
        const task = s.backlogTasks.find((t) => t.id === taskId);
        if (!task) return s;
        return {
          backlogTasks: s.backlogTasks.filter((t) => t.id !== taskId),
          tasks: [...s.tasks, { ...task, ...updates, isBacklog: false }],
        };
      });
    } else if (updates.isBacklog === true) {
      set((s) => {
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task) return s;
        return {
          tasks: s.tasks.filter((t) => t.id !== taskId),
          backlogTasks: [...s.backlogTasks, { ...task, ...updates, isBacklog: true }],
        };
      });
    }

    if (updates.status === "COMPLETED" && celebrationDate) {
      queueMicrotask(() => {
        triggerDayCompletionCelebration(celebrationDate, get().tasks);
      });
    }

    if (state.apiAvailable) {
      try {
        const requestBody: Record<string, unknown> = { ...updates };
        const nullableKeys = [
          "description",
          "plannedTime",
          "actualTime",
          "scheduledDate",
          "scheduledStart",
          "scheduledEnd",
          "channelId",
          "backlogBucket",
          "backlogFolder",
        ];

        nullableKeys.forEach((key) => {
          if (hasOwn(key) && updates[key as keyof typeof updates] === undefined) {
            requestBody[key] = null;
          }
        });

        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
      } catch {
        // Optimistic update already applied
      }
    }
  },

  deleteTask: async (taskId) => {
    const state = get();

    // Optimistic delete from both lists
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== taskId),
      backlogTasks: s.backlogTasks.filter((t) => t.id !== taskId),
    }));
    clearTaskUiState(taskId);

    if (state.apiAvailable) {
      try {
        await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      } catch {
        // Already removed locally
      }
    }
  },

  toggleTaskStatus: (taskId: string) => {
    const state = get();
    const task = findTaskInCollections(
      state.tasks,
      state.backlogTasks,
      taskId
    );
    if (!task) return;

    const newStatus = task.status === "COMPLETED" ? "OPEN" : "COMPLETED";
    get().updateTask(taskId, { status: newStatus });
  },

  reorderTasks: (taskIds: string[]) => {
    const state = get();
    const updated = state.tasks.map((t) => {
      const newPos = taskIds.indexOf(t.id);
      return newPos >= 0 ? { ...t, position: newPos } : t;
    });
    set({ tasks: updated });

    // Persist positions to API
    if (state.apiAvailable) {
      taskIds.forEach((id, position) => {
        fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        }).catch(() => {});
      });
    }
  },

  scheduleBacklogTask: async (taskId: string, date: string) => {
    get().updateTask(taskId, {
      isBacklog: false,
      scheduledDate: date,
      backlogBucket: undefined,
      backlogFolder: undefined,
    });
  },

  addSubtask: async (parentId: string, title: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, parentId }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const newSubtask = mapApiTask(data as Record<string, unknown>);
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === parentId
            ? { ...t, subtasks: [...(t.subtasks || []), newSubtask] }
            : t
        ),
      }));
    } catch {
      set({ apiAvailable: false });
    }
  },

  toggleSubtaskStatus: async (parentId: string, subtaskId: string) => {
    const state = get();
    const parent = state.tasks.find((t) => t.id === parentId);
    const subtask = parent?.subtasks?.find((s) => s.id === subtaskId);
    if (!subtask) return;

    const newStatus: Task["status"] = subtask.status === "COMPLETED" ? "OPEN" : "COMPLETED";

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === parentId
          ? {
              ...t,
              subtasks: t.subtasks?.map((st) =>
                st.id === subtaskId
                  ? {
                      ...st,
                      status: newStatus,
                      completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : undefined,
                    }
                  : st
              ),
            }
          : t
      ),
    }));

    if (newStatus === "COMPLETED" && parent?.scheduledDate) {
      queueMicrotask(() => {
        triggerDayCompletionCelebration(parent.scheduledDate!, get().tasks);
      });
    }

    if (state.apiAvailable) {
      try {
        await fetch(`/api/tasks/${subtaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch { /* optimistic already applied */ }
    }
  },

  reorderSubtasks: (parentId: string, subtaskIds: string[]) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== parentId || !t.subtasks) return t;
        const reordered = subtaskIds
          .map((id) => t.subtasks!.find((st) => st.id === id))
          .filter((st): st is Task => st !== undefined)
          .map((st, i) => ({ ...st, position: i }));
        return { ...t, subtasks: reordered };
      }),
    }));
    const state = get();
    if (state.apiAvailable) {
      subtaskIds.forEach((id, position) => {
        fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        }).catch(() => {});
      });
    }
  },

  renameSubtask: async (parentId: string, subtaskId: string, title: string) => {
    if (!title.trim()) return;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === parentId
          ? {
              ...t,
              subtasks: t.subtasks?.map((st) =>
                st.id === subtaskId ? { ...st, title: title.trim() } : st
              ),
            }
          : t
      ),
    }));
    const state = get();
    if (state.apiAvailable) {
      try {
        await fetch(`/api/tasks/${subtaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
      } catch { /* optimistic already applied */ }
    }
  },

  // --- Event CRUD ---

  addEvent: async (eventData) => {
    const state = get();

    if (state.apiAvailable) {
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const newEvent = mapApiEvent(data as Record<string, unknown>);
        set((s) => ({ events: [...s.events, newEvent] }));
        return;
      } catch {
        // Fall through to local-only
      }
    }

    // Local-only fallback
    const newEvent: CalendarEvent = {
      id: `local-${Date.now()}`,
      title: eventData.title,
      description: eventData.description,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      color: eventData.color,
      isRecurring: eventData.isRecurring ?? false,
      recurringRule: eventData.recurringRule ?? null,
      calendarCategoryId: eventData.calendarCategoryId,
    };
    set((s) => ({ events: [...s.events, newEvent] }));
  },

  updateEvent: async (eventId, updates) => {
    const state = get();

    // Optimistic update
    set((s) => ({
      events: s.events.map((e) =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }));

    if (state.apiAvailable) {
      try {
        await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch {
        // Optimistic update already applied
      }
    }
  },

  deleteEvent: async (eventId) => {
    const state = get();

    // Optimistic delete
    set((s) => ({ events: s.events.filter((e) => e.id !== eventId) }));

    if (state.apiAvailable) {
      try {
        await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      } catch {
        // Already removed locally
      }
    }
  },
}));

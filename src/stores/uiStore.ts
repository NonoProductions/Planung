"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toLocalDateString } from "@/lib/date";
import type { CelebrationTrigger, CelebrationType } from "@/types";

const MAX_RITUAL_HISTORY = 45;

interface ActiveCelebration {
  id: string;
  trigger: CelebrationTrigger;
  type: CelebrationType;
  title: string;
  subtitle: string;
  startedAt: number;
}

type QuickAddRequest =
  | {
      mode: "day";
      value: string;
    }
  | {
      mode: "backlog";
      value: string;
    }
  | null;

interface UIState {
  sidebarExpanded: boolean;
  darkMode: boolean;
  calendarVisible: boolean;
  selectedDate: string;
  selectedTaskId: string | null;
  editingTaskId: string | null;
  calendarPlanningTaskId: string | null;
  planningRitualOpen: boolean;
  shutdownRitualOpen: boolean;
  shutdownRitualDate: string | null;
  quietMode: boolean;
  quietModeDate: string | null;
  celebrationEnabled: boolean;
  celebrationType: CelebrationType;
  activeCelebration: ActiveCelebration | null;
  shortcutHelpOpen: boolean;
  focusTaskId: string | null;
  quickAddRequest: QuickAddRequest;
  autoPlanningPromptedDate: string | null;
  autoShutdownPromptedDate: string | null;
  weekRowVisible: boolean;
  planningRitualCompletedDates: string[];
  shutdownRitualCompletedDates: string[];
  dailyShutdownNotes: Record<string, string>;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleDarkMode: () => void;
  toggleCalendar: () => void;
  setCalendarVisible: (visible: boolean) => void;
  setSelectedDate: (date: string) => void;
  selectTask: (taskId: string | null) => void;
  clearSelectedTask: () => void;
  startEditingTask: (taskId: string) => void;
  stopEditingTask: () => void;
  setCalendarPlanningTaskId: (taskId: string | null) => void;
  openPlanningRitual: () => void;
  closePlanningRitual: () => void;
  completePlanningRitual: (date: string) => void;
  openShutdownRitual: (date?: string) => void;
  closeShutdownRitual: () => void;
  openShortcutHelp: () => void;
  closeShortcutHelp: () => void;
  openFocusMode: (taskId: string) => void;
  closeFocusMode: () => void;
  requestDayQuickAdd: (date: string) => void;
  requestBacklogQuickAdd: (target?: string) => void;
  clearQuickAddRequest: () => void;
  completeShutdownRitual: (date: string, reflection?: string) => void;
  setAutoPlanningPromptedDate: (date: string | null) => void;
  setAutoShutdownPromptedDate: (date: string | null) => void;
  toggleWeekRowVisible: () => void;
  setWeekRowVisible: (visible: boolean) => void;
  clearQuietMode: () => void;
  fetchRitualCompletions: () => Promise<void>;
  setCelebrationEnabled: (enabled: boolean) => void;
  setCelebrationType: (type: CelebrationType) => void;
  triggerCelebration: (payload: {
    trigger: CelebrationTrigger;
    title?: string;
    subtitle?: string;
    type?: CelebrationType;
  }) => void;
  clearCelebration: () => void;
}

function trimDateHistory(dates: string[], nextDate: string) {
  return [nextDate, ...dates.filter((date) => date !== nextDate)].slice(
    0,
    MAX_RITUAL_HISTORY
  );
}

function trimNoteHistory(
  notes: Record<string, string>,
  date: string,
  note: string
) {
  const nextNotes = { ...notes };
  const cleanNote = note.trim();

  if (cleanNote) {
    nextNotes[date] = cleanNote;
  } else {
    delete nextNotes[date];
  }

  return Object.fromEntries(
    Object.entries(nextNotes)
      .sort((first, second) => second[0].localeCompare(first[0]))
      .slice(0, MAX_RITUAL_HISTORY)
  );
}

function getCelebrationCopy(trigger: CelebrationTrigger) {
  switch (trigger) {
    case "all_tasks_complete":
      return {
        title: "Alles erledigt",
        subtitle: "Dein Tag ist aufgeraeumt und abgeschlossen.",
      };
    case "planning_ritual":
      return {
        title: "Planung steht",
        subtitle: "Der Tag hat jetzt einen klaren Fokus.",
      };
    case "shutdown_ritual":
      return {
        title: "Shutdown geschafft",
        subtitle: "Feierabend kann sich jetzt gut anfuehlen.",
      };
    default:
      return {
        title: "Starker Moment",
        subtitle: "Zeit fuer einen kleinen Sieg.",
      };
  }
}

function applyDarkModeClass(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", enabled);
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarExpanded: false,
      darkMode: false,
      calendarVisible: true,
      selectedDate: toLocalDateString(new Date()),
      selectedTaskId: null,
      editingTaskId: null,
      calendarPlanningTaskId: null,
      planningRitualOpen: false,
      shutdownRitualOpen: false,
      shutdownRitualDate: null,
      quietMode: false,
      quietModeDate: null,
      celebrationEnabled: true,
      celebrationType: "confetti",
      activeCelebration: null,
      shortcutHelpOpen: false,
      focusTaskId: null,
      quickAddRequest: null,
      autoPlanningPromptedDate: null,
      autoShutdownPromptedDate: null,
      weekRowVisible: true,
      planningRitualCompletedDates: [],
      shutdownRitualCompletedDates: [],
      dailyShutdownNotes: {},

      toggleSidebar: () =>
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

      setSidebarExpanded: (expanded: boolean) =>
        set({ sidebarExpanded: expanded }),

      toggleDarkMode: () =>
        set((state) => {
          const nextDarkMode = !state.darkMode;

          if (typeof document !== "undefined") {
            const html = document.documentElement;
            html.classList.add("theme-transition");
            applyDarkModeClass(nextDarkMode);
            window.setTimeout(
              () => html.classList.remove("theme-transition"),
              450
            );
          }

          return { darkMode: nextDarkMode };
        }),

      toggleCalendar: () =>
        set((state) => ({ calendarVisible: !state.calendarVisible })),

      setCalendarVisible: (visible: boolean) =>
        set({ calendarVisible: visible }),

      setSelectedDate: (date: string) => set({ selectedDate: date }),

      selectTask: (taskId: string | null) => set({ selectedTaskId: taskId }),

      clearSelectedTask: () => set({ selectedTaskId: null }),

      startEditingTask: (taskId: string) =>
        set({
          editingTaskId: taskId,
          selectedTaskId: taskId,
          quickAddRequest: null,
        }),

      stopEditingTask: () => set({ editingTaskId: null }),

      setCalendarPlanningTaskId: (taskId: string | null) =>
        set({ calendarPlanningTaskId: taskId }),

      openPlanningRitual: () =>
        set({
          planningRitualOpen: true,
          shutdownRitualOpen: false,
          editingTaskId: null,
          shortcutHelpOpen: false,
          focusTaskId: null,
          quickAddRequest: null,
        }),

      closePlanningRitual: () => set({ planningRitualOpen: false }),

      completePlanningRitual: (date: string) => {
        set((state) => ({
          planningRitualOpen: false,
          planningRitualCompletedDates: trimDateHistory(
            state.planningRitualCompletedDates,
            date
          ),
        }));
        get().triggerCelebration({ trigger: "planning_ritual" });

        // Persist to server so other devices see the completion
        fetch("/api/rituals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, type: "planning" }),
        }).catch(() => {});
      },

      openShutdownRitual: (date) =>
        set((state) => ({
          shutdownRitualOpen: true,
          shutdownRitualDate: date ?? state.selectedDate,
          planningRitualOpen: false,
          editingTaskId: null,
          shortcutHelpOpen: false,
          focusTaskId: null,
          quickAddRequest: null,
        })),

      closeShutdownRitual: () =>
        set({ shutdownRitualOpen: false, shutdownRitualDate: null }),

      openShortcutHelp: () =>
        set({ shortcutHelpOpen: true, focusTaskId: null }),

      closeShortcutHelp: () => set({ shortcutHelpOpen: false }),

      openFocusMode: (taskId: string) =>
        set({
          focusTaskId: taskId,
          selectedTaskId: taskId,
          shortcutHelpOpen: false,
          quickAddRequest: null,
        }),

      closeFocusMode: () => set({ focusTaskId: null }),

      requestDayQuickAdd: (date: string) =>
        set({
          quickAddRequest: { mode: "day", value: date },
          editingTaskId: null,
          focusTaskId: null,
        }),

      requestBacklogQuickAdd: (target = "this_week") =>
        set({
          quickAddRequest: { mode: "backlog", value: target },
          editingTaskId: null,
          focusTaskId: null,
        }),

      clearQuickAddRequest: () => set({ quickAddRequest: null }),

      setAutoPlanningPromptedDate: (date: string | null) =>
        set({ autoPlanningPromptedDate: date }),

      setAutoShutdownPromptedDate: (date: string | null) =>
        set({ autoShutdownPromptedDate: date }),

      toggleWeekRowVisible: () =>
        set((state) => ({ weekRowVisible: !state.weekRowVisible })),

      setWeekRowVisible: (visible: boolean) => set({ weekRowVisible: visible }),

      completeShutdownRitual: (date: string, reflection = "") => {
        set((state) => ({
          shutdownRitualOpen: false,
          shutdownRitualDate: null,
          quietMode: true,
          quietModeDate: date,
          shutdownRitualCompletedDates: trimDateHistory(
            state.shutdownRitualCompletedDates,
            date
          ),
          dailyShutdownNotes: trimNoteHistory(
            state.dailyShutdownNotes,
            date,
            reflection
          ),
        }));
        get().triggerCelebration({ trigger: "shutdown_ritual" });

        // Persist to server so other devices see the completion
        fetch("/api/rituals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            type: "shutdown",
            note: reflection.trim() || undefined,
          }),
        }).catch(() => {});
      },

      clearQuietMode: () => set({ quietMode: false }),

      fetchRitualCompletions: async () => {
        try {
          const res = await fetch("/api/rituals");
          if (!res.ok) return;
          const data = (await res.json()) as {
            planning: string[];
            shutdown: string[];
            notes: Record<string, string>;
          };

          set((state) => {
            // Merge server dates into local dates (union, deduplicated)
            const mergedPlanning = Array.from(
              new Set([...state.planningRitualCompletedDates, ...data.planning])
            )
              .sort((a, b) => b.localeCompare(a))
              .slice(0, MAX_RITUAL_HISTORY);

            const mergedShutdown = Array.from(
              new Set([...state.shutdownRitualCompletedDates, ...data.shutdown])
            )
              .sort((a, b) => b.localeCompare(a))
              .slice(0, MAX_RITUAL_HISTORY);

            const mergedNotes = { ...data.notes, ...state.dailyShutdownNotes };
            const trimmedNotes = Object.fromEntries(
              Object.entries(mergedNotes)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, MAX_RITUAL_HISTORY)
            );

            return {
              planningRitualCompletedDates: mergedPlanning,
              shutdownRitualCompletedDates: mergedShutdown,
              dailyShutdownNotes: trimmedNotes,
            };
          });
        } catch {
          // Offline / API unavailable – keep local state as-is
        }
      },

      setCelebrationEnabled: (enabled: boolean) =>
        set((state) => ({
          celebrationEnabled: enabled,
          activeCelebration: enabled ? state.activeCelebration : null,
        })),

      setCelebrationType: (type: CelebrationType) =>
        set({ celebrationType: type }),

      triggerCelebration: ({ trigger, title, subtitle, type }) => {
        const state = get();
        if (!state.celebrationEnabled) return;

        const copy = getCelebrationCopy(trigger);

        set({
          activeCelebration: {
            id: `celebration-${Date.now()}`,
            trigger,
            type: type ?? state.celebrationType,
            title: title ?? copy.title,
            subtitle: subtitle ?? copy.subtitle,
            startedAt: Date.now(),
          },
        });
      },

      clearCelebration: () => set({ activeCelebration: null }),
    }),
    {
      name: "sunsama-ui-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        darkMode: state.darkMode,
        quietMode: state.quietMode,
        quietModeDate: state.quietModeDate,
        celebrationEnabled: state.celebrationEnabled,
        celebrationType: state.celebrationType,
        weekRowVisible: state.weekRowVisible,
        planningRitualCompletedDates: state.planningRitualCompletedDates,
        shutdownRitualCompletedDates: state.shutdownRitualCompletedDates,
        dailyShutdownNotes: state.dailyShutdownNotes,
      }),
      onRehydrateStorage: () => (state) => {
        applyDarkModeClass(Boolean(state?.darkMode));
      },
    }
  )
);

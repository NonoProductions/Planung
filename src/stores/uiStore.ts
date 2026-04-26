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
  celebrationEnabled: boolean;
  celebrationType: CelebrationType;
  activeCelebration: ActiveCelebration | null;
  shortcutHelpOpen: boolean;
  focusTaskId: string | null;
  quickAddRequest: QuickAddRequest;
  autoPlanningPromptedDate: string | null;
  weekRowVisible: boolean;
  planningRitualCompletedDates: string[];
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
  openShortcutHelp: () => void;
  closeShortcutHelp: () => void;
  openFocusMode: (taskId: string) => void;
  closeFocusMode: () => void;
  requestDayQuickAdd: (date: string) => void;
  requestBacklogQuickAdd: (target?: string) => void;
  clearQuickAddRequest: () => void;
  setAutoPlanningPromptedDate: (date: string | null) => void;
  toggleWeekRowVisible: () => void;
  setWeekRowVisible: (visible: boolean) => void;
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
      celebrationEnabled: true,
      celebrationType: "confetti",
      activeCelebration: null,
      shortcutHelpOpen: false,
      focusTaskId: null,
      quickAddRequest: null,
      autoPlanningPromptedDate: null,
      weekRowVisible: true,
      planningRitualCompletedDates: [],

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

      toggleWeekRowVisible: () =>
        set((state) => ({ weekRowVisible: !state.weekRowVisible })),

      setWeekRowVisible: (visible: boolean) => set({ weekRowVisible: visible }),

      fetchRitualCompletions: async () => {
        try {
          const res = await fetch("/api/rituals");
          if (!res.ok) return;
          const data = (await res.json()) as {
            planning: string[];
          };

          set((state) => {
            const mergedPlanning = Array.from(
              new Set([...state.planningRitualCompletedDates, ...data.planning])
            )
              .sort((a, b) => b.localeCompare(a))
              .slice(0, MAX_RITUAL_HISTORY);

            return {
              planningRitualCompletedDates: mergedPlanning,
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
        celebrationEnabled: state.celebrationEnabled,
        celebrationType: state.celebrationType,
        weekRowVisible: state.weekRowVisible,
        planningRitualCompletedDates: state.planningRitualCompletedDates,
      }),
      onRehydrateStorage: () => (state) => {
        applyDarkModeClass(Boolean(state?.darkMode));
      },
    }
  )
);

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlannerSettings, WorkloadDay } from "@/types";

export const defaultSettings: PlannerSettings = {
  profile: {
    name: "Noe Laurent",
    email: "noe@example.com",
    avatar: "NL",
  },
  display: {
    themeMode: "system",
    weekStart: "monday",
    timeFormat: "24h",
    language: "de",
  },
  planning: {
    planningTime: "08:30",
    autoRollover: true,
    rolloverPosition: "top",
  },
  workload: {
    monday: 480,
    tuesday: 480,
    wednesday: 480,
    thursday: 480,
    friday: 420,
    saturday: 180,
    sunday: 120,
  },
  focus: {
    pomodoroMinutes: 25,
    breakReminderMinutes: 50,
    autoFocusOnTimerStart: true,
  },
  calendar: {
    defaultEventDuration: 30,
  },
  celebrations: {
    enabled: true,
    type: "confetti",
  },
  notifications: {
    planningReminder: true,
    shutdownReminder: true,
    timerDone: true,
    taskDue: true,
  },
};

interface SettingsState {
  settings: PlannerSettings;
  hydrated: boolean;
  lastUpdatedAt: string;
  updateSettings: (updater: (settings: PlannerSettings) => PlannerSettings) => void;
  updateSection: <K extends keyof PlannerSettings>(
    section: K,
    updates: Partial<PlannerSettings[K]>
  ) => void;
  updateWorkloadDay: (day: WorkloadDay, minutes: number) => void;
  resetSettings: () => void;
  setHydrated: (hydrated: boolean) => void;
}

function nowIso() {
  return new Date().toISOString();
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      hydrated: false,
      lastUpdatedAt: nowIso(),

      updateSettings: (updater) =>
        set((state) => ({
          settings: updater(state.settings),
          lastUpdatedAt: nowIso(),
        })),

      updateSection: (section, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [section]: {
              ...state.settings[section],
              ...updates,
            },
          },
          lastUpdatedAt: nowIso(),
        })),

      updateWorkloadDay: (day, minutes) =>
        set((state) => ({
          settings: {
            ...state.settings,
            workload: {
              ...state.settings.workload,
              [day]: Math.max(0, Math.min(720, Math.round(minutes))),
            },
          },
          lastUpdatedAt: nowIso(),
        })),

      resetSettings: () =>
        set({
          settings: defaultSettings,
          lastUpdatedAt: nowIso(),
        }),

      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "sunsama-settings-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createTimeEntry,
  fetchActiveTimeEntry,
  RUNNING_TIMER_STORAGE_KEY,
  startRunningTimeEntry,
  stopRunningTimeEntry,
  toRunningTimerState,
  type RunningTimerState,
} from "@/lib/time-tracking";

interface TimerResult {
  persisted: boolean;
}

interface TimeTrackingState {
  runningTimer: RunningTimerState | null;
  submitting: boolean;
  hydratedFromServer: boolean;
  hydrateRunningTimer: () => Promise<void>;
  startTimer: (taskId: string) => Promise<TimerResult | null>;
  stopTimer: () => Promise<TimerResult | null>;
}

export const useTimeTrackingStore = create<TimeTrackingState>()(
  persist(
    (set, get) => ({
      runningTimer: null,
      submitting: false,
      hydratedFromServer: false,

      hydrateRunningTimer: async () => {
        if (get().hydratedFromServer) return;

        try {
          const entry = await fetchActiveTimeEntry();
          set({
            runningTimer: entry ? toRunningTimerState(entry) : null,
            hydratedFromServer: true,
          });
        } catch {
          set({ hydratedFromServer: true });
        }
      },

      startTimer: async (taskId: string) => {
        if (!taskId || get().runningTimer || get().submitting) return null;

        set({ submitting: true });

        try {
          const result = await startRunningTimeEntry(taskId);
          set({
            runningTimer: toRunningTimerState(result.entry),
          });
          return { persisted: result.persisted };
        } finally {
          set({ submitting: false });
        }
      },

      stopTimer: async () => {
        const runningTimer = get().runningTimer;
        if (!runningTimer || get().submitting) return null;

        set({ submitting: true });

        try {
          const result = runningTimer.entryId.startsWith("running-")
            ? await createTimeEntry({
                taskId: runningTimer.taskId,
                startTime: runningTimer.startedAt,
                endTime: new Date().toISOString(),
                duration: Math.max(
                  1,
                  Math.round(
                    (Date.now() - new Date(runningTimer.startedAt).getTime()) / 1000
                  )
                ),
              })
            : await stopRunningTimeEntry(runningTimer.entryId);

          return { persisted: result.persisted };
        } finally {
          set({ runningTimer: null, submitting: false });
        }
      },
    }),
    {
      name: RUNNING_TIMER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        runningTimer: state.runningTimer,
      }),
    }
  )
);

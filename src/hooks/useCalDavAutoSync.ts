"use client";

import { useEffect, useRef } from "react";
import { useTaskStore } from "@/stores/taskStore";

const POLL_INTERVAL_MS = 3 * 60 * 1000;
const REFOCUS_THROTTLE_MS = 60 * 1000;
const MIN_GAP_BETWEEN_SYNCS_MS = 30 * 1000;

export function useCalDavAutoSync() {
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const lastSyncAtRef = useRef(0);
  const inFlightRef = useRef(false);
  // Once the sync endpoint signals "not configured" / "unauthorized" we stop
  // polling for the rest of this session — re-enabled on next page load.
  const disabledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (cancelled || disabledRef.current || inFlightRef.current) return;
      if (Date.now() - lastSyncAtRef.current < MIN_GAP_BETWEEN_SYNCS_MS) return;

      inFlightRef.current = true;
      try {
        const res = await fetch("/api/integrations/caldav/sync", {
          method: "POST",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 400 || res.status === 401 || res.status === 404) {
            disabledRef.current = true;
          }
          return;
        }

        lastSyncAtRef.current = Date.now();
        await fetchTasks();
      } catch {
        // Network blips: ignore, next interval retries.
      } finally {
        inFlightRef.current = false;
      }
    };

    const initialTimer = window.setTimeout(() => {
      void sync();
    }, 1500);

    const interval = window.setInterval(() => {
      void sync();
    }, POLL_INTERVAL_MS);

    const onRefocus = () => {
      if (Date.now() - lastSyncAtRef.current < REFOCUS_THROTTLE_MS) return;
      void sync();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onRefocus();
    };

    window.addEventListener("focus", onRefocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onRefocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchTasks]);
}

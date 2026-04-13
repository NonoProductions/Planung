"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Menu, MoonStar, PanelRightClose, PanelRightOpen } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import ConfettiCelebration from "@/components/celebrations/ConfettiCelebration";
import FocusModeModal from "@/components/focus/FocusModeModal";
import Sidebar from "@/components/layout/Sidebar";
import DailyShutdownModal from "@/components/rituals/DailyShutdownModal";
import ShortcutOverlay from "@/components/ui/ShortcutOverlay";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";
import { toLocalDateString } from "@/lib/date";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTimeTrackingStore } from "@/stores/timeTrackingStore";
import { useUIStore } from "@/stores/uiStore";

interface AppShellProps {
  children: ReactNode;
  bodyClassName?: string;
}

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/backlog")) {
    return {
      eyebrow: "Capture",
      title: "Backlog",
    };
  }

  if (pathname.startsWith("/analytics")) {
    return {
      eyebrow: "Insights",
      title: "Analytics",
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      eyebrow: "Studio",
      title: "Settings",
    };
  }

  if (pathname.startsWith("/planning")) {
    return {
      eyebrow: "Ritual",
      title: "Daily Planning",
    };
  }

  if (pathname.startsWith("/week")) {
    return {
      eyebrow: "Weekly",
      title: "Focus",
    };
  }

  return {
    eyebrow: "Planner",
    title: "Today",
  };
}

function supportsCalendar(pathname: string) {
  return pathname === "/" || pathname.startsWith("/backlog");
}

const AUTO_SHUTDOWN_HOUR = 18;

function hasReachedClockTime(now: Date, clockValue: string) {
  const [hoursValue, minutesValue] = clockValue.split(":");
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return false;
  }

  return (
    now.getHours() > hours ||
    (now.getHours() === hours && now.getMinutes() >= minutes)
  );
}

export default function AppShell({ children, bodyClassName }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  useKeyboardShortcuts();

  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);
  const calendarVisible = useUIStore((state) => state.calendarVisible);
  const toggleCalendar = useUIStore((state) => state.toggleCalendar);
  const darkMode = useUIStore((state) => state.darkMode);
  const planningRitualCompletedDates = useUIStore(
    (state) => state.planningRitualCompletedDates
  );
  const shutdownRitualOpen = useUIStore((state) => state.shutdownRitualOpen);
  const openShutdownRitual = useUIStore((state) => state.openShutdownRitual);
  const quietMode = useUIStore((state) => state.quietMode);
  const quietModeDate = useUIStore((state) => state.quietModeDate);
  const clearQuietMode = useUIStore((state) => state.clearQuietMode);
  const fetchRitualCompletions = useUIStore(
    (state) => state.fetchRitualCompletions
  );
  const planningTime = useSettingsStore(
    (state) => state.settings.planning.planningTime
  );
  const hydrateRunningTimer = useTimeTrackingStore(
    (state) => state.hydrateRunningTimer
  );
  const autoPlanningPromptedDate = useUIStore((state) => state.autoPlanningPromptedDate);
  const setAutoPlanningPromptedDate = useUIStore((state) => state.setAutoPlanningPromptedDate);
  const autoPromptedDate = useUIStore((state) => state.autoShutdownPromptedDate);
  const setAutoPromptedDate = useUIStore((state) => state.setAutoShutdownPromptedDate);

  useEffect(() => {
    setSidebarExpanded(false);
  }, [pathname, setSidebarExpanded]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    void hydrateRunningTimer();
  }, [hydrateRunningTimer]);

  // Sync ritual completions from server so rituals completed on other devices are recognized
  useEffect(() => {
    fetchRitualCompletions();
  }, [fetchRitualCompletions]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const checkPlanningWindow = () => {
      const now = new Date();
      const today = toLocalDateString(now);

      if (
        pathname.startsWith("/planning") ||
        planningRitualCompletedDates.includes(today) ||
        today === autoPlanningPromptedDate
      ) {
        return;
      }

      if (hasReachedClockTime(now, planningTime)) {
        router.push("/planning");
        setAutoPlanningPromptedDate(today);
      }
    };

    checkPlanningWindow();
    const intervalId = window.setInterval(checkPlanningWindow, 60_000);
    return () => window.clearInterval(intervalId);
  }, [
    autoPlanningPromptedDate,
    pathname,
    planningRitualCompletedDates,
    planningTime,
    router,
    setAutoPlanningPromptedDate,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const checkShutdownWindow = () => {
      const now = new Date();
      const today = toLocalDateString(now);

      if (quietMode && quietModeDate && quietModeDate !== today) {
        clearQuietMode();
      }

      if (
        !shutdownRitualOpen &&
        !pathname.startsWith("/planning") &&
        now.getHours() >= AUTO_SHUTDOWN_HOUR &&
        today !== quietModeDate &&
        today !== autoPromptedDate
      ) {
        openShutdownRitual(today);
        setAutoPromptedDate(today);
      }
    };

    checkShutdownWindow();
    const intervalId = window.setInterval(checkShutdownWindow, 60_000);
    return () => window.clearInterval(intervalId);
  }, [
    autoPromptedDate,
    clearQuietMode,
    openShutdownRitual,
    pathname,
    quietMode,
    quietModeDate,
    setAutoPromptedDate,
    shutdownRitualOpen,
  ]);

  const shellClassName = ["app-shell", sidebarExpanded ? "app-shell--sidebar-open" : ""]
    .filter(Boolean)
    .join(" ");
  const shellBodyClassName = ["app-shell__body", bodyClassName].filter(Boolean).join(" ");
  const pageMeta = getPageMeta(pathname);
  const hasCalendar = supportsCalendar(pathname);
  const quietModeLabel = useMemo(() => {
    if (!quietModeDate) return "heute";
    try {
      return format(parseISO(quietModeDate), "d. MMMM", { locale: de });
    } catch {
      return quietModeDate;
    }
  }, [quietModeDate]);

  return (
    <div className={shellClassName}>
      {quietMode && (
        <div
          className="pointer-events-none fixed left-1/2 top-4 z-[85] w-[min(92vw,520px)] -translate-x-1/2 rounded-[22px] border px-4 py-3 shadow-lg"
          style={{
            borderColor: "rgba(228, 220, 211, 0.94)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(249,245,239,0.96))",
            boxShadow: "0 18px 34px rgba(88, 75, 57, 0.12)",
          }}
        >
          <div className="pointer-events-auto flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(141,124,246,0.16), rgba(244,173,70,0.16))",
                color: "var(--accent-primary)",
              }}
            >
              <MoonStar size={17} strokeWidth={1.9} />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                Ruhemodus
              </p>
              <p
                className="text-[13px] leading-6"
                style={{ color: "var(--text-primary)" }}
              >
                Shutdown fuer {quietModeLabel} abgeschlossen. Der Tag ist jetzt
                sauber geparkt.
              </p>
            </div>

            <button
              type="button"
              onClick={clearQuietMode}
              className="rounded-full border px-3 py-2 text-[12px] font-medium"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "#ffffff",
                color: "var(--text-secondary)",
              }}
            >
              Weiterarbeiten
            </button>
          </div>
        </div>
      )}

      <header className="mobile-topbar">
        <button
          type="button"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="mobile-topbar__button"
          aria-label={sidebarExpanded ? "Navigation schliessen" : "Navigation oeffnen"}
          aria-expanded={sidebarExpanded}
          aria-controls="app-navigation"
        >
          <Menu size={18} strokeWidth={2.2} />
        </button>

        <div className="mobile-topbar__copy">
          <span className="mobile-topbar__eyebrow">{pageMeta.eyebrow}</span>
          <span className="mobile-topbar__title">{pageMeta.title}</span>
        </div>

        {hasCalendar ? (
          <button
            type="button"
            onClick={toggleCalendar}
            className="mobile-topbar__button"
            aria-label={calendarVisible ? "Kalender schliessen" : "Kalender oeffnen"}
          >
            {calendarVisible ? (
              <PanelRightClose size={18} strokeWidth={2.1} />
            ) : (
              <PanelRightOpen size={18} strokeWidth={2.1} />
            )}
          </button>
        ) : (
          <span className="mobile-topbar__spacer" aria-hidden="true" />
        )}
      </header>

      {sidebarExpanded && (
        <button
          type="button"
          className="app-shell__backdrop"
          aria-label="Navigation schliessen"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      <div className="app-shell__sidebar">
        <Sidebar onClose={() => setSidebarExpanded(false)} />
      </div>

      <div
        className={shellBodyClassName}
        style={quietMode ? { filter: "saturate(0.88)" } : undefined}
      >
        {children}
      </div>

      <ConfettiCelebration />
      <ShortcutOverlay />
      <FocusModeModal />
      <DailyShutdownModal />
    </div>
  );
}

"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
import { useUIStore } from "@/stores/uiStore";

interface AppShellProps {
  children: ReactNode;
  bodyClassName?: string;
  /** Replaces the page title in the mobile top bar (e.g. date navigation). */
  mobileCenter?: ReactNode;
  /** Replaces the right-hand button in the mobile top bar. */
  mobileAction?: ReactNode;
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
      title: "Weekly planning",
    };
  }

  return {
    eyebrow: "Planner",
    title: "Today",
  };
}

function supportsCalendar(pathname: string) {
  return pathname === "/";
}

const AUTO_SHUTDOWN_HOUR = 18;
const MOBILE_QUERY = "(max-width: 767px)";

const subscribeNoop = () => () => {};

// Persisted UI state is only available on the client, so it must not affect the SSR markup.
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

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

export default function AppShell({
  children,
  bodyClassName,
  mobileCenter,
  mobileAction,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  useKeyboardShortcuts();

  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);
  const isClient = useIsClient();
  const storedSidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarCollapsed = isClient && storedSidebarCollapsed;
  const calendarVisible = useUIStore((state) => state.calendarVisible);
  const toggleCalendar = useUIStore((state) => state.toggleCalendar);
  const setCalendarVisible = useUIStore((state) => state.setCalendarVisible);
  const planningRitualCompletedDates = useUIStore(
    (state) => state.planningRitualCompletedDates
  );
  const shutdownRitualOpen = useUIStore((state) => state.shutdownRitualOpen);
  const openShutdownRitual = useUIStore((state) => state.openShutdownRitual);
  const quietMode = useUIStore((state) => state.quietMode);
  const quietModeDate = useUIStore((state) => state.quietModeDate);
  const clearQuietMode = useUIStore((state) => state.clearQuietMode);
  const planningTime = useSettingsStore(
    (state) => state.settings.planning.planningTime
  );
  const autoPlanningPromptedDate = useUIStore((state) => state.autoPlanningPromptedDate);
  const setAutoPlanningPromptedDate = useUIStore((state) => state.setAutoPlanningPromptedDate);
  const autoPromptedDate = useUIStore((state) => state.autoShutdownPromptedDate);
  const setAutoPromptedDate = useUIStore((state) => state.setAutoShutdownPromptedDate);

  useEffect(() => {
    setSidebarExpanded(false);
  }, [pathname, setSidebarExpanded]);

  // On phones the calendar is a full-screen sheet, so it only opens on demand.
  // Until this has run, CSS keeps the server-rendered calendar hidden on mobile.
  useLayoutEffect(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setCalendarVisible(false);
    }
  }, [pathname, setCalendarVisible]);

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

      if (!hasReachedClockTime(now, planningTime)) return;

      // Only prompt when nothing is planned for today yet.
      setAutoPlanningPromptedDate(today);
      void fetch(`/api/tasks?date=${today}`)
        .then((response) => (response.ok ? response.json() : []))
        .then((todayTasks: unknown) => {
          if (Array.isArray(todayTasks) && todayTasks.length === 0) {
            router.push("/planning");
          }
        })
        .catch(() => {});
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
    shutdownRitualOpen,
  ]);

  const shellClassName = [
    "app-shell",
    sidebarExpanded ? "app-shell--sidebar-open" : "",
    sidebarCollapsed ? "app-shell--sidebar-collapsed" : "",
    isClient ? "" : "app-shell--calendar-pending",
  ]
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
        <div className="app-toast" role="status">
          <span className="app-icon-tile">
            <MoonStar size={16} strokeWidth={2} />
          </span>

          <div className="app-toast__text">
            <p className="settings-row__label">Ruhemodus</p>
            <p className="settings-row__description">
              Shutdown für {quietModeLabel} abgeschlossen. Der Tag ist jetzt
              sauber geparkt.
            </p>
          </div>

          <button type="button" onClick={clearQuietMode} className="workspace-button">
            Weiterarbeiten
          </button>
        </div>
      )}

      <header className="mobile-topbar">
        <button
          type="button"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="mobile-topbar__button"
          aria-label={sidebarExpanded ? "Navigation schließen" : "Navigation öffnen"}
          aria-expanded={sidebarExpanded}
          aria-controls="app-navigation"
        >
          <Menu size={18} strokeWidth={2.2} />
        </button>

        <div className="mobile-topbar__copy">
          {mobileCenter ?? (
            <>
              <span className="mobile-topbar__eyebrow">{pageMeta.eyebrow}</span>
              <span className="mobile-topbar__title">{pageMeta.title}</span>
            </>
          )}
        </div>

        {mobileAction ? (
          mobileAction
        ) : hasCalendar ? (
          <button
            type="button"
            onClick={toggleCalendar}
            className="mobile-topbar__button"
            aria-label={calendarVisible ? "Kalender schließen" : "Kalender öffnen"}
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
          aria-label="Navigation schließen"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      <div className="app-shell__sidebar">
        <Sidebar
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarExpanded(false)}
        />
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

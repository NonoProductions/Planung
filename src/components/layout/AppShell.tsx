"use client";

import { useEffect, type ReactNode } from "react";
import { Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import ConfettiCelebration from "@/components/celebrations/ConfettiCelebration";
import FocusModeModal from "@/components/focus/FocusModeModal";
import Sidebar from "@/components/layout/Sidebar";
import ShortcutOverlay from "@/components/ui/ShortcutOverlay";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";
import { toLocalDateString } from "@/lib/date";
import { useTaskStore } from "@/stores/taskStore";
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

  if (pathname.startsWith("/weekly-planning")) {
    return {
      eyebrow: "Weekly",
      title: "Weekly Planning",
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

export default function AppShell({ children, bodyClassName }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  useKeyboardShortcuts();

  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);
  const calendarVisible = useUIStore((state) => state.calendarVisible);
  const toggleCalendar = useUIStore((state) => state.toggleCalendar);
  const setCalendarVisible = useUIStore((state) => state.setCalendarVisible);
  const darkMode = useUIStore((state) => state.darkMode);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchRitualCompletions = useUIStore(
    (state) => state.fetchRitualCompletions
  );
  const hydrateRunningTimer = useTimeTrackingStore(
    (state) => state.hydrateRunningTimer
  );
  const autoPlanningPromptedDate = useUIStore((state) => state.autoPlanningPromptedDate);
  const setAutoPlanningPromptedDate = useUIStore((state) => state.setAutoPlanningPromptedDate);

  useEffect(() => {
    setSidebarExpanded(false);
  }, [pathname, setSidebarExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) {
      setCalendarVisible(false);
    }
  }, [setCalendarVisible]);

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

    const today = toLocalDateString(new Date());
    if (pathname.startsWith("/planning") || today === autoPlanningPromptedDate) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      await fetchTasks(today);
      if (cancelled) return;

      const hasTodayTasks = useTaskStore
        .getState()
        .tasks.some((t) => t.scheduledDate === today && !t.isBacklog);

      if (!hasTodayTasks) {
        router.push("/planning");
        setAutoPlanningPromptedDate(today);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoPlanningPromptedDate, fetchTasks, pathname, router, setAutoPlanningPromptedDate]);

  const shellClassName = ["app-shell", sidebarExpanded ? "app-shell--sidebar-open" : ""]
    .filter(Boolean)
    .join(" ");
  const shellBodyClassName = ["app-shell__body", bodyClassName].filter(Boolean).join(" ");
  const pageMeta = getPageMeta(pathname);
  const hasCalendar = supportsCalendar(pathname);

  return (
    <div className={shellClassName}>

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

      <div className={shellBodyClassName}>
        {children}
      </div>

      <ConfettiCelebration />
      <ShortcutOverlay />
      <FocusModeModal />
    </div>
  );
}

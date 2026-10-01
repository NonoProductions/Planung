"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { format, isSameDay, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useDndContext, useDndMonitor, useDroppable } from "@dnd-kit/core";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import { haptic } from "@/lib/haptics";

export const CALENDAR_PEEK_ID = "calendar-peek";

const MOBILE_QUERY = "(max-width: 767px)";
/** How long a card has to rest on the peek before the big calendar opens. */
const OPEN_DELAY_MS = 380;
/** Matches the calendar sheet's entrance in HomeApp. */
const SHEET_OPEN_MS = 340;
const PEEK_HOURS = 3;

function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
}

/**
 * Phones only: while a task is dragged, a small calendar window rises from the
 * bottom. Resting the card on it opens the full calendar sheet, where the card
 * can then be dropped at a time. Letting go anywhere else closes it again.
 */
export default function MobileCalendarPeek() {
  const isMobile = useIsMobile();
  const { active, measureDroppableContainers } = useDndContext();
  const calendarVisible = useUIStore((state) => state.calendarVisible);
  const setCalendarVisible = useUIStore((state) => state.setCalendarVisible);
  const [opening, setOpening] = useState(false);
  const openedByDrag = useRef(false);

  const showPeek = isMobile && active !== null && !calendarVisible;

  const openCalendar = () => {
    if (useUIStore.getState().calendarVisible) return;
    openedByDrag.current = true;
    setOpening(true);
    setCalendarVisible(true);
    haptic("medium");
    // The sheet scales in; measure the drop grid once it has settled.
    window.setTimeout(() => measureDroppableContainers(["calendar-dropzone"]), SHEET_OPEN_MS + 20);
  };

  const finishDrag = (overId: string | number | undefined) => {
    setOpening(false);
    if (overId === CALENDAR_PEEK_ID) {
      openCalendar();
      openedByDrag.current = false;
      return;
    }
    if (openedByDrag.current && overId !== "calendar-dropzone") {
      setCalendarVisible(false);
    }
    openedByDrag.current = false;
  };

  useDndMonitor({
    onDragStart: () => setOpening(false),
    onDragEnd: (event) => finishDrag(event.over?.id),
    onDragCancel: () => finishDrag(undefined),
  });

  return (
    <AnimatePresence custom={opening}>
      {showPeek && <PeekWindow key="peek" onOpen={openCalendar} />}
    </AnimatePresence>
  );
}

const peekVariants: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.94 },
  shown: { opacity: 1, y: 0, scale: 1 },
  // Opening grows into the sheet; a plain drop just sinks away.
  exit: (opening: boolean) =>
    opening
      ? { opacity: 0, scale: 1.06, y: -12, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }
      : { opacity: 0, y: 28, scale: 0.96, transition: { duration: 0.18, ease: "easeIn" } },
};

function PeekWindow({ onOpen }: { onOpen: () => void }) {
  const { measureDroppableContainers } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({ id: CALENDAR_PEEK_ID });
  const selectedDate = useUIStore((state) => state.selectedDate);
  const events = useTaskStore((state) => state.events);
  const tasks = useTaskStore((state) => state.tasks);
  const fetchEvents = useTaskStore((state) => state.fetchEvents);
  const openNow = useEffectEvent(() => onOpen());

  // The calendar is closed on phones, so its events may not be loaded yet.
  useEffect(() => {
    void fetchEvents(selectedDate);
  }, [fetchEvents, selectedDate]);

  useEffect(() => {
    if (!isOver) return undefined;
    haptic("select");
    const timer = window.setTimeout(() => openNow(), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isOver]);

  const day = parseISO(selectedDate);
  const today = isToday(day);
  const firstHour = today ? Math.min(new Date().getHours(), 24 - PEEK_HOURS) : 9;
  const windowStart = new Date(day);
  windowStart.setHours(firstHour, 0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + PEEK_HOURS * 3_600_000);

  const blocks = useMemo(() => {
    const items = [
      ...events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        color: event.color,
      })),
      ...tasks
        .filter((task) => task.scheduledStart && task.scheduledEnd)
        .map((task) => ({
          id: task.id,
          title: task.title,
          start: task.scheduledStart!,
          end: task.scheduledEnd!,
          color: task.channel?.color,
        })),
    ];

    return items
      .map((item) => ({ ...item, start: parseISO(item.start), end: parseISO(item.end) }))
      .filter(
        (item) => isSameDay(item.start, day) && item.end > windowStart && item.start < windowEnd
      )
      .map((item) => {
        const span = windowEnd.getTime() - windowStart.getTime();
        const from = Math.max(item.start.getTime(), windowStart.getTime());
        const to = Math.min(item.end.getTime(), windowEnd.getTime());
        return {
          id: item.id,
          title: item.title,
          color: item.color,
          top: ((from - windowStart.getTime()) / span) * 100,
          height: Math.max(((to - from) / span) * 100, 9),
        };
      });
    // windowStart/windowEnd derive from selectedDate and the current hour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tasks, selectedDate, firstHour]);

  const nowOffset = today
    ? ((Date.now() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())) * 100
    : null;

  return (
    <motion.div
      className="calendar-peek-layer"
      variants={peekVariants}
      initial="hidden"
      animate="shown"
      exit="exit"
      transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.8 }}
      onAnimationComplete={() => measureDroppableContainers([CALENDAR_PEEK_ID])}
    >
      <div
        ref={setNodeRef}
        className={isOver ? "calendar-peek calendar-peek--over" : "calendar-peek"}
        style={{ "--peek-open-delay": `${OPEN_DELAY_MS}ms` } as React.CSSProperties}
      >
        <div className="calendar-peek__header">
          <span className="calendar-peek__icon">
            <CalendarDays size={14} strokeWidth={2.2} />
          </span>
          <span className="calendar-peek__title">Kalender</span>
          <span className="calendar-peek__date">
            {today ? "Heute" : format(day, "EEE, d. MMM", { locale: de })}
          </span>
        </div>

        <div className="calendar-peek__timeline">
          {Array.from({ length: PEEK_HOURS }, (_, index) => (
            <div
              key={index}
              className="calendar-peek__hour"
              style={{ top: `${(index / PEEK_HOURS) * 100}%` }}
            >
              <span>{String(firstHour + index).padStart(2, "0")}:00</span>
            </div>
          ))}

          <div className="calendar-peek__lane">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="calendar-peek__block"
                style={{
                  top: `${block.top}%`,
                  height: `${block.height}%`,
                  "--block-color": block.color ?? "var(--accent-primary)",
                } as React.CSSProperties}
              >
                {block.title}
              </div>
            ))}
            {nowOffset !== null && nowOffset >= 0 && nowOffset <= 100 && (
              <div className="calendar-peek__now" style={{ top: `${nowOffset}%` }} />
            )}
          </div>
        </div>

        <div className="calendar-peek__hint">
          {isOver ? "Kalender öffnet …" : "Hierher ziehen zum Einplanen"}
        </div>
        <div className="calendar-peek__progress" aria-hidden="true" />
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMinutes, parseISO, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { edgeScrollStep } from "@/lib/edgeScroll";

const SNAP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
const DRAG_THRESHOLD_PX = 4;
interface TimeBlockProps {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  isEvent: boolean;
  startHour: number;
  hourHeight: number;
  onClick?: (e: React.MouseEvent) => void;
  /** Enables drag-to-move and resize; called with the new ISO start/end once released. */
  onTimeChange?: (startTime: string, endTime: string) => void;
}

interface DragState {
  mode: "move" | "resize";
  pointerId: number;
  originY: number;
  /** Latest finger position, re-applied while the calendar auto-scrolls. */
  clientY: number;
  scroller: HTMLElement | null;
  originScroll: number;
  startMinutes: number;
  endMinutes: number;
  moved: boolean;
  preview: { start: number; end: number } | null;
}

function snap(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesToLabel(minutes: number) {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export default function TimeBlock({
  title,
  startTime,
  endTime,
  color = "#4f46e5",
  isEvent,
  startHour,
  hourHeight,
  onClick,
  onTimeChange,
}: TimeBlockProps) {
  const dragRef = useRef<DragState | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);

  const original = useMemo(() => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = startMinutes + Math.round((end.getTime() - start.getTime()) / 60000);

    return { start: startMinutes, end: endMinutes };
  }, [startTime, endTime]);

  const current = preview ?? original;
  // While moving, the block stays at its original top and follows the finger
  // with a transform (no layout, no re-render per move); only the time label
  // re-renders, once per 5-minute step.
  const top = ((original.start - startHour * 60) / 60) * hourHeight;
  const height = Math.max(((current.end - current.start) / 60) * hourHeight, 28);

  const timeLabel = `${minutesToLabel(current.start)} - ${minutesToLabel(current.end)}`;
  const isCompact = height <= 42;
  const draggable = Boolean(onTimeChange);
  const dragging = preview !== null;

  const stopAutoScroll = () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = null;
  };

  useEffect(() => stopAutoScroll, []);

  const beginDrag = (mode: DragState["mode"]) => (event: React.PointerEvent<HTMLElement>) => {
    if (!draggable || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const scroller = blockRef.current?.closest<HTMLElement>(".calendar-scroll") ?? null;
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      originY: event.clientY,
      clientY: event.clientY,
      scroller,
      originScroll: scroller?.scrollTop ?? 0,
      startMinutes: original.start,
      endMinutes: original.end,
      moved: false,
      preview: null,
    };
  };

  /** Places the block for the finger position, counting what has been scrolled since. */
  const applyDrag = (drag: DragState) => {
    const scrolled = (drag.scroller?.scrollTop ?? 0) - drag.originScroll;
    const deltaMinutes = ((drag.clientY - drag.originY + scrolled) / hourHeight) * 60;

    if (drag.mode === "move") {
      const duration = drag.endMinutes - drag.startMinutes;
      const rawStart = Math.min(
        Math.max(drag.startMinutes + deltaMinutes, 0),
        DAY_MINUTES - duration
      );
      const offset = ((rawStart - drag.startMinutes) / 60) * hourHeight;
      if (blockRef.current) blockRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;

      const start = Math.min(Math.max(snap(rawStart), 0), DAY_MINUTES - duration);
      if (drag.preview?.start !== start) {
        drag.preview = { start, end: start + duration };
        setPreview(drag.preview);
      }
    } else {
      const end = Math.min(
        Math.max(snap(drag.endMinutes + deltaMinutes), drag.startMinutes + SNAP_MINUTES),
        DAY_MINUTES
      );
      if (drag.preview?.end !== end) {
        drag.preview = { start: drag.startMinutes, end };
        setPreview(drag.preview);
      }
    }
  };

  // Near the top or bottom edge the calendar scrolls on its own, faster the
  // closer the finger gets, and the block keeps following the finger.
  const runAutoScroll = () => {
    const drag = dragRef.current;
    const scroller = drag?.scroller;
    if (!drag || !scroller) {
      scrollFrameRef.current = null;
      return;
    }

    // Keeps running while the finger rests near an edge; it only stops once
    // the finger leaves the edge zone or the day has no more room to scroll.
    const step = edgeScrollStep(scroller, drag.clientY);
    if (step === 0) {
      scrollFrameRef.current = null;
      return;
    }

    scroller.scrollTop += step;
    applyDrag(drag);
    scrollFrameRef.current = requestAnimationFrame(runAutoScroll);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.clientY = event.clientY;
    if (!drag.moved && Math.abs(event.clientY - drag.originY) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;

    applyDrag(drag);
    if (scrollFrameRef.current === null) {
      scrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    stopAutoScroll();
    // Cleared in the same frame the new time is committed, so nothing jumps.
    if (blockRef.current) blockRef.current.style.transform = "";

    const result = drag.preview;
    if (!drag.moved || !result) {
      setPreview(null);
      return;
    }

    suppressClickRef.current = true;
    const unchanged = result.start === drag.startMinutes && result.end === drag.endMinutes;
    if (!unchanged) {
      const day = startOfDay(parseISO(startTime));
      onTimeChange?.(
        addMinutes(day, result.start).toISOString(),
        addMinutes(day, result.end).toISOString()
      );
    }
    setPreview(null);
  };

  const handleClick = (event: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  return (
    <div
      ref={blockRef}
      onClick={handleClick}
      onPointerDown={beginDrag("move")}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`group absolute left-0 right-0 ${
        draggable ? "cursor-grab touch-none select-none active:cursor-grabbing" : "cursor-pointer"
      } ${dragging ? "z-30" : "z-10"}`}
      style={{
        top,
        height,
        willChange: dragging ? "transform" : undefined,
        WebkitTouchCallout: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative h-full overflow-hidden rounded-[8px] border border-white/30 transition-shadow duration-200"
        style={{
          backgroundColor: color,
          boxShadow: dragging
            ? "0 16px 28px rgba(var(--shadow-rgb), 0.18)"
            : "0 1px 0 rgba(var(--shadow-rgb), 0.05), 0 8px 14px rgba(var(--shadow-rgb), 0.07)",
          opacity: isEvent ? 1 : 0.94,
        }}
        whileHover={{
          boxShadow: "0 12px 20px rgba(var(--shadow-rgb), 0.1)",
        }}
      >
        <div
          className={isCompact ? "calendar-block calendar-block--compact" : "calendar-block"}
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)",
          }}
        >
          <p
            className="calendar-block__title"
            style={{ color: "#ffffff", WebkitLineClamp: isCompact ? 1 : 2 }}
          >
            {title}
          </p>
          {(height > 40 || dragging) && (
            <p
              className="calendar-block__time"
              style={{
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {timeLabel}
            </p>
          )}
        </div>

        {!isEvent && (
          <div
            onPointerDown={beginDrag("resize")}
            className="absolute bottom-0 left-0 right-0 flex h-2.5 cursor-s-resize items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          >
            <div
              className="h-[2px] w-8 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.82)", opacity: 0.82 }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

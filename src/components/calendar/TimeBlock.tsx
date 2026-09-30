"use client";

import { useMemo, useRef, useState } from "react";
import { addMinutes, parseISO, startOfDay } from "date-fns";
import { motion } from "framer-motion";

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
  startMinutes: number;
  endMinutes: number;
  moved: boolean;
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
  const suppressClickRef = useRef(false);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);

  const original = useMemo(() => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = startMinutes + Math.round((end.getTime() - start.getTime()) / 60000);

    return { start: startMinutes, end: endMinutes };
  }, [startTime, endTime]);

  const current = preview ?? original;
  const top = ((current.start - startHour * 60) / 60) * hourHeight;
  const height = Math.max(((current.end - current.start) / 60) * hourHeight, 28);

  const timeLabel = `${minutesToLabel(current.start)} - ${minutesToLabel(current.end)}`;
  const isCompact = height <= 42;
  const draggable = Boolean(onTimeChange);
  const dragging = preview !== null;

  const beginDrag = (mode: DragState["mode"]) => (event: React.PointerEvent<HTMLElement>) => {
    if (!draggable || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      originY: event.clientY,
      startMinutes: original.start,
      endMinutes: original.end,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.originY;
    if (!drag.moved && Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;

    const deltaMinutes = (deltaY / hourHeight) * 60;

    if (drag.mode === "move") {
      const duration = drag.endMinutes - drag.startMinutes;
      const start = Math.min(
        Math.max(snap(drag.startMinutes + deltaMinutes), 0),
        DAY_MINUTES - duration
      );
      setPreview({ start, end: start + duration });
    } else {
      const end = Math.min(
        Math.max(snap(drag.endMinutes + deltaMinutes), drag.startMinutes + SNAP_MINUTES),
        DAY_MINUTES
      );
      setPreview({ start: drag.startMinutes, end });
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    if (!drag.moved || !preview) {
      setPreview(null);
      return;
    }

    suppressClickRef.current = true;
    const unchanged = preview.start === drag.startMinutes && preview.end === drag.endMinutes;
    if (!unchanged) {
      const day = startOfDay(parseISO(startTime));
      onTimeChange?.(
        addMinutes(day, preview.start).toISOString(),
        addMinutes(day, preview.end).toISOString()
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
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      onClick={handleClick}
      onPointerDown={beginDrag("move")}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`group absolute left-0 right-0 overflow-hidden rounded-[8px] border border-white/30 transition-all duration-200 ${
        draggable ? "cursor-grab touch-none select-none active:cursor-grabbing" : "cursor-pointer"
      } ${dragging ? "z-30" : "z-10"}`}
      style={{
        top,
        height,
        backgroundColor: color,
        boxShadow: dragging
          ? "0 16px 28px rgba(var(--shadow-rgb), 0.18)"
          : "0 1px 0 rgba(var(--shadow-rgb), 0.05), 0 8px 14px rgba(var(--shadow-rgb), 0.07)",
        opacity: isEvent ? 1 : 0.94,
        transitionDuration: dragging ? "90ms" : undefined,
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
  );
}

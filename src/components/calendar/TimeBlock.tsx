"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";

interface TimeBlockProps {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  isEvent: boolean;
  isPomodoroBreak?: boolean;
  startHour: number;
  hourHeight: number;
  onClick?: (e: React.MouseEvent) => void;
}

function formatCompactTimeLabel(value: string) {
  const date = parseISO(value);
  return format(date, "HH:mm");
}

export default function TimeBlock({
  title,
  startTime,
  endTime,
  color = "#4f46e5",
  isEvent,
  isPomodoroBreak = false,
  startHour,
  hourHeight,
  onClick,
}: TimeBlockProps) {
  const { top, height, rawHeight } = useMemo(() => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const startMinutes =
      (start.getHours() - startHour) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - startHour) * 60 + end.getMinutes();
    const duration = endMinutes - startMinutes;
    const computedHeight = Math.max((duration / 60) * hourHeight, 0);
    // Keep short pomodoro breaks visually tiny so they do not spill into the
    // following work block and appear as gray overlays.
    const minHeight = isPomodoroBreak ? 4 : isEvent ? 16 : 28;

    return {
      top: (startMinutes / 60) * hourHeight,
      rawHeight: computedHeight,
      height: Math.max(computedHeight, minHeight),
    };
  }, [startTime, endTime, startHour, hourHeight, isEvent, isPomodoroBreak]);

  const timeLabel = `${formatCompactTimeLabel(startTime)} - ${formatCompactTimeLabel(endTime)}`;
  const isTiny = height <= 22;
  const isCompact = height <= 42;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className="group absolute left-0 right-0 z-10 box-border cursor-pointer overflow-hidden border border-white/30 transition-all duration-200"
      style={{
        top,
        height,
        borderRadius: isPomodoroBreak ? 7 : 8,
        backgroundColor: color,
        boxShadow: "0 1px 0 rgba(77, 66, 54, 0.05), 0 8px 14px rgba(77, 66, 54, 0.07)",
        opacity: isPomodoroBreak ? 0.95 : isEvent ? 1 : 0.94,
      }}
      whileHover={{
        boxShadow: "0 12px 20px rgba(77, 66, 54, 0.1)",
      }}
    >
      <div
        className={isCompact ? "calendar-block calendar-block--compact" : "calendar-block"}
        style={{
          padding: isPomodoroBreak ? "4px 10px" : undefined,
          background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)",
        }}
      >
        {!isPomodoroBreak && (
          <p
            className="calendar-block__title"
            style={{ color: "#ffffff", WebkitLineClamp: isCompact ? 1 : 2 }}
          >
            {title}
          </p>
        )}
        {isPomodoroBreak && !isTiny && (
          <p
            className="calendar-block__title"
            style={{
              color: "#ffffff",
              WebkitLineClamp: 1,
              fontSize: "11px",
              lineHeight: 1.1,
            }}
          >
            {title}
          </p>
        )}
        {height > 40 && !isPomodoroBreak && (
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

      {!isEvent && !isPomodoroBreak && rawHeight > 22 && (
        <div className="absolute bottom-0 left-0 right-0 flex h-2.5 cursor-s-resize items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div
            className="h-[2px] w-8 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.82)", opacity: 0.82 }}
          />
        </div>
      )}
    </motion.div>
  );
}

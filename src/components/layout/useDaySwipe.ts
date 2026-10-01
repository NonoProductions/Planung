"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animate, useMotionValue } from "framer-motion";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useDndMonitor } from "@dnd-kit/core";
import { haptic } from "@/lib/haptics";

/** How far (share of the width) or how fast (px/ms) a swipe must go to switch the day. */
const SWITCH_DISTANCE = 0.22;
const SWITCH_VELOCITY = 0.45;
const SLIDE = { type: "tween", duration: 0.2, ease: [0.4, 0, 0.2, 1] } as const;

/**
 * Horizontal swipe on touch screens to step through days. The caller renders the
 * previous, current and next day side by side and offsets the track by the returned
 * x, so the neighbouring day (name and tasks) is already visible while swiping.
 * Steps to an adjacent day made elsewhere (arrows) slide the same way. Must be used
 * inside a DndContext, so a task being dragged never also switches the day.
 */
export function useDaySwipe({
  containerRef,
  enabled,
  date,
  onStep,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  date: string;
  onStep: (direction: 1 | -1) => void;
}) {
  const x = useMotionValue(0);
  const isTaskDragging = useRef(false);
  /** Set when a swipe already slid the track onto the new day. */
  const finishedSwipe = useRef(false);
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  });

  useDndMonitor({
    onDragStart: () => {
      isTaskDragging.current = true;
      animate(x, 0, SLIDE);
    },
    onDragEnd: () => (isTaskDragging.current = false),
    onDragCancel: () => (isTaskDragging.current = false),
  });

  // The track is re-centred on the new day before paint. After a swipe it is already
  // in place; a one-day step from elsewhere slides over from the old day.
  const previousDate = useRef(date);
  useLayoutEffect(() => {
    const previous = previousDate.current;
    previousDate.current = date;
    if (previous === date) return;
    if (enabled) haptic("select");
    const wasSwipe = finishedSwipe.current;
    finishedSwipe.current = false;
    x.jump(0);
    const step = differenceInCalendarDays(parseISO(date), parseISO(previous));
    if (!enabled || wasSwipe || Math.abs(step) !== 1) return;
    const width = containerRef.current?.clientWidth ?? window.innerWidth;
    x.jump(step * width);
    animate(x, 0, SLIDE);
  }, [date, enabled, containerRef, x]);

  useEffect(() => {
    const element = containerRef.current;
    if (!enabled || !element) return undefined;

    let start: { x: number; y: number; time: number } | null = null;
    let axis: "x" | "y" | null = null;
    let isSwitching = false;

    const reset = () => {
      start = null;
      axis = null;
    };

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        isSwitching ||
        event.touches.length !== 1 ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        reset();
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
      axis = null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!start) return;
      if (isTaskDragging.current) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      }
      if (axis !== "x") return;

      // Horizontal swipe: keep the page from scrolling and follow the finger.
      event.preventDefault();
      const width = element.clientWidth;
      x.set(Math.max(-width, Math.min(width, dx)));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!start || axis !== "x") {
        reset();
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const velocity = Math.abs(dx) / Math.max(event.timeStamp - start.time, 1);
      const width = element.clientWidth;
      reset();

      if (Math.abs(dx) < width * SWITCH_DISTANCE && velocity < SWITCH_VELOCITY) {
        animate(x, 0, SLIDE);
        return;
      }

      // Swiping left shows the next day, swiping right the previous one.
      const direction = dx < 0 ? 1 : -1;
      isSwitching = true;
      animate(x, -direction * width, {
        ...SLIDE,
        onComplete: () => {
          isSwitching = false;
          finishedSwipe.current = true;
          onStepRef.current(direction);
        },
      });
    };

    const onTouchCancel = () => {
      if (axis === "x") animate(x, 0, SLIDE);
      reset();
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchCancel);
    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, containerRef, x]);

  return x;
}

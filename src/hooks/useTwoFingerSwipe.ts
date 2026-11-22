"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { haptic } from "@/lib/haptics";

/** Horizontal trackpad scroll (px) one gesture needs before the week switches. */
const WHEEL_DISTANCE = 70;
/** A pause this long (ms) between wheel events ends a trackpad gesture. */
const WHEEL_GESTURE_GAP = 220;
/** Earliest (ms) a new swipe can be told apart from the momentum of the last one. */
const WHEEL_NEW_SWIPE_DELAY = 150;
/** Horizontal distance (px) two fingers must travel on a touch screen. */
const TOUCH_DISTANCE = 60;

/** Whether something between target and container can still scroll that way itself. */
function canScrollNatively(target: EventTarget | null, container: HTMLElement, direction: 1 | -1) {
  let node = target instanceof Element ? (target as HTMLElement) : null;
  while (node) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") {
        const maxScroll = node.scrollWidth - node.clientWidth;
        if (direction === 1 ? node.scrollLeft < maxScroll - 1 : node.scrollLeft > 1) return true;
      }
    }
    if (node === container) break;
    node = node.parentElement;
  }
  return false;
}

/**
 * Two-finger swipe left/right to step forward or back (a week, a day): a horizontal
 * trackpad scroll on the PC, or two fingers on a touch screen. Swiping left steps
 * forward. Where the content itself scrolls sideways (narrow windows), it scrolls
 * first and only a new swipe from the edge steps.
 */
export function useTwoFingerSwipe(
  containerRef: RefObject<HTMLElement | null>,
  onStep: (direction: 1 | -1) => void,
  enabled = true
) {
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!enabled || !element) return undefined;

    const step = (direction: 1 | -1) => {
      haptic("select");
      onStepRef.current(direction);
    };

    // Trackpad: one gesture (including its momentum) switches at most one week.
    let lastWheel = 0;
    let lastAbs = 0;
    let lastDirection = 0;
    let risingStreak = 0;
    let accumulated = 0;
    let gestureUsed = false;
    let usedAt = 0;

    const startGesture = () => {
      accumulated = 0;
      gestureUsed = false;
      risingStreak = 0;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // pinch zoom
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

      const abs = Math.abs(event.deltaX);
      const direction = event.deltaX > 0 ? 1 : -1;

      // A pause, a reversal, or deltas growing again while the momentum of the last
      // swipe is still fading out all mean the fingers started a new swipe.
      if (event.timeStamp - lastWheel > WHEEL_GESTURE_GAP || direction !== lastDirection) {
        startGesture();
      } else if (gestureUsed) {
        risingStreak = abs > lastAbs + 1 ? risingStreak + 1 : 0;
        if (risingStreak >= 2 && event.timeStamp - usedAt > WHEEL_NEW_SWIPE_DELAY) {
          startGesture();
        }
      }
      lastWheel = event.timeStamp;
      lastAbs = abs;
      lastDirection = direction;

      if (canScrollNatively(event.target, element, direction)) {
        gestureUsed = true;
        usedAt = event.timeStamp;
        return;
      }

      // Also keeps the browser from going back/forward in history.
      event.preventDefault();
      if (gestureUsed) return;

      accumulated += event.deltaX;
      if (Math.abs(accumulated) >= WHEEL_DISTANCE) {
        gestureUsed = true;
        usedAt = event.timeStamp;
        step(accumulated > 0 ? 1 : -1);
      }
    };

    // Touch screen: two fingers moving sideways together.
    let touchStart: { x: number; y: number } | null = null;
    let touchDelta = { x: 0, y: 0 };

    const midpoint = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        touchStart = midpoint(event.touches);
        touchDelta = { x: 0, y: 0 };
      } else {
        touchStart = null;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!touchStart || event.touches.length !== 2) return;
      const point = midpoint(event.touches);
      touchDelta = { x: point.x - touchStart.x, y: point.y - touchStart.y };
      if (Math.abs(touchDelta.x) > 10 && Math.abs(touchDelta.x) > Math.abs(touchDelta.y) * 1.2) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!touchStart) return;
      const { x, y } = touchDelta;
      touchStart = null;
      if (Math.abs(x) >= TOUCH_DISTANCE && Math.abs(x) > Math.abs(y) * 1.2) {
        step(x < 0 ? 1 : -1);
      }
    };

    const onTouchCancel = () => {
      touchStart = null;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchCancel);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [containerRef, enabled]);
}

/**
 * When `value` changes, the element glides in briefly from the side the new value
 * comes from: a later value (e.g. a later date) from the right.
 */
export function useSlideIn(
  elementRef: RefObject<HTMLElement | null>,
  value: string,
  enabled = true
) {
  const previousValue = useRef(value);
  useLayoutEffect(() => {
    const previous = previousValue.current;
    previousValue.current = value;
    const element = elementRef.current;
    if (!enabled || previous === value || !element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const direction = value > previous ? 1 : -1;
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(
      [
        { opacity: 0.35, translate: `${direction * 28}px 0` },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    );
  }, [value, enabled, elementRef]);
}

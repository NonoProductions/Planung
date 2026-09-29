"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;

export interface PopoverAnchor {
  /** Viewport x coordinate (e.g. clientX of the click). */
  x: number;
  /** Viewport y coordinate (e.g. clientY of the click). */
  y: number;
}

interface CalendarPopoverProps {
  anchor: PopoverAnchor;
  width: number;
  panelRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/**
 * Fixed-position panel rendered into <body>, so the calendar's scroll area can
 * never clip it. It opens next to the anchor and is shifted until it fits
 * completely inside the viewport.
 */
export default function CalendarPopover({
  anchor,
  width,
  panelRef,
  children,
}: CalendarPopoverProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const localRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const panel = localRef.current;
    if (!panel) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    // Prefer the right side of the click, flip to the left if it does not fit.
    let left = anchor.x + ANCHOR_GAP;
    if (left + panelWidth > viewportWidth - VIEWPORT_MARGIN) {
      left = anchor.x - ANCHOR_GAP - panelWidth;
    }
    left = Math.min(
      Math.max(VIEWPORT_MARGIN, left),
      Math.max(VIEWPORT_MARGIN, viewportWidth - panelWidth - VIEWPORT_MARGIN)
    );

    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.y - 24),
      Math.max(VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN)
    );

    setPosition({ top, left });
  }, [anchor.x, anchor.y]);

  useLayoutEffect(() => {
    place();

    const panel = localRef.current;
    const observer = panel ? new ResizeObserver(place) : null;
    if (panel && observer) observer.observe(panel);
    window.addEventListener("resize", place);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [place]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={(node) => {
        localRef.current = node;
        panelRef.current = node;
      }}
      data-calendar-form
      className="popover-panel fixed z-[140] flex flex-col overflow-hidden"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{
        width,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: `calc(100dvh - ${VIEWPORT_MARGIN * 2}px)`,
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

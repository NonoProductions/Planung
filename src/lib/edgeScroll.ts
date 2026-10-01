/** How far from the visible top/bottom edge dragging starts to scroll. */
const EDGE_ZONE_PX = 110;
const MAX_STEP_PX = 18;

/**
 * The part of the scroller the user can actually see: on phones the tab bar
 * sits over the bottom of the page, so the bottom edge is where it begins.
 */
function visibleBounds(scroller: HTMLElement) {
  const rect = scroller.getBoundingClientRect();
  let bottom = Math.min(rect.bottom, window.innerHeight);
  const dock = document.querySelector<HTMLElement>(".sidebar-mobile-dock");
  if (dock && dock.offsetParent !== null) {
    const dockTop = dock.getBoundingClientRect().top;
    if (dockTop > rect.top) bottom = Math.min(bottom, dockTop);
  }
  return { top: Math.max(rect.top, 0), bottom };
}

/**
 * Whole-pixel scroll step for a finger at `y` (negative = up), growing toward
 * the edge. Whole pixels matter: iOS rounds scrollTop, so fractional steps
 * would never move the calendar.
 */
export function edgeScrollStep(scroller: HTMLElement, y: number) {
  const { top, bottom } = visibleBounds(scroller);
  const zone = Math.min(EDGE_ZONE_PX, (bottom - top) / 3);
  const fromTop = y - top;
  const fromBottom = bottom - y;

  let step = 0;
  if (fromTop < zone) step = -MAX_STEP_PX * (1 - Math.max(fromTop, 0) / zone) ** 1.5;
  else if (fromBottom < zone) step = MAX_STEP_PX * (1 - Math.max(fromBottom, 0) / zone) ** 1.5;
  if (step === 0) return 0;

  const whole = Math.sign(step) * Math.max(1, Math.round(Math.abs(step)));
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (whole < 0 && scroller.scrollTop <= 0) return 0;
  if (whole > 0 && scroller.scrollTop >= maxScroll - 1) return 0;
  return whole;
}

/** True while `y` is in the middle of the visible scroller, away from both edges. */
export function isInsideScrollerBody(scroller: HTMLElement, y: number) {
  const { top, bottom } = visibleBounds(scroller);
  const zone = Math.min(EDGE_ZONE_PX, (bottom - top) / 3);
  return y > top + zone && y < bottom - zone;
}

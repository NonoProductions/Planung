"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  closestCenter,
  useDndContext,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type DropAnimationFunction,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task } from "@/types";
import { haptic } from "@/lib/haptics";
import { edgeScrollStep, isInsideScrollerBody } from "@/lib/edgeScroll";
import { CALENDAR_PEEK_ID } from "@/components/calendar/MobileCalendarPeek";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { dateFromDayDropId, dayListId, getDropDate, getSourceDate } from "@/lib/dayDrop";

/** Moves a task to another day, placed where it was dropped in that day's list. */
function moveTaskToDay(task: Task, targetDate: string, over: Over, tasks: Task[], dropY: number | null) {
  const targetTasks = tasks
    .filter((item) => item.scheduledDate === targetDate && !item.isBacklog && item.id !== task.id)
    .sort((first, second) => first.position - second.position);

  let index = targetTasks.findIndex((item) => item.id === over.id);
  if (index === -1) {
    index = targetTasks.length;
  } else if (dropY !== null && dropY > over.rect.top + over.rect.height / 2) {
    index += 1;
  }

  // A task with a time block keeps its time of day on the new day.
  const shift = task.scheduledDate
    ? differenceInCalendarDays(parseISO(targetDate), parseISO(task.scheduledDate))
    : 0;
  const shiftTime = (value?: string) =>
    value && shift !== 0 ? addDays(new Date(value), shift).toISOString() : value;

  const ordered = [...targetTasks];
  ordered.splice(index, 0, task);

  const store = useTaskStore.getState();
  void store.updateTask(task.id, {
    scheduledDate: targetDate,
    scheduledStart: shiftTime(task.scheduledStart),
    scheduledEnd: shiftTime(task.scheduledEnd),
    position: index,
  });
  store.reorderTasks(ordered.map((item) => item.id));
}

interface DndWrapperProps {
  children: React.ReactNode;
}

interface ClientCoordinates {
  clientX: number;
  clientY: number;
}

function isTouchEvent(event: Event): event is TouchEvent {
  return typeof TouchEvent !== "undefined" && event instanceof TouchEvent;
}

function isPointerLikeEvent(event: Event): event is MouseEvent | PointerEvent {
  return (
    (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) ||
    event instanceof MouseEvent
  );
}

function getClientCoordinates(event: Event | null): ClientCoordinates | null {
  if (!event) return null;

  if (isPointerLikeEvent(event)) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  if (isTouchEvent(event) && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  return null;
}

/**
 * The lifted card glides into its slot and straightens out on the way, while
 * the slot's dashed outline slowly fades underneath it.
 */
const dropAnimation: DropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
  sideEffects: (args) => {
    const overlayCleanup = defaultDropAnimationSideEffects({
      className: { dragOverlay: "is-dropping" },
    })(args);
    // Show the dashed slot, then let it fade out while the card lands on it.
    const slot = args.active.node;
    slot.classList.add("is-drag-placeholder");
    void slot.offsetWidth;
    slot.classList.add("is-drop-settling");
    return () => {
      slot.classList.remove("is-drag-placeholder", "is-drop-settling");
      overlayCleanup?.();
    };
  },
};

/** Dropped onto the calendar: the card melts away where it was let go. */
const calendarDropAnimation: DropAnimation = {
  duration: 180,
  easing: "ease-out",
  keyframes: ({ transform: { initial } }) => [
    { transform: CSS.Transform.toString(initial), opacity: 1 },
    {
      transform: CSS.Transform.toString({ ...initial, scaleX: 0.92, scaleY: 0.92 }),
      opacity: 0,
    },
  ],
  sideEffects: defaultDropAnimationSideEffects({
    className: { dragOverlay: "is-dropping" },
  }),
};

const OTHER_DAY_DURATION = 320;
const OTHER_DAY_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Where the cursor was last seen during the drag. */
let lastPointer: { x: number; y: number } | null = null;

/** The task's real card after the move (not the lifted copy). */
function findLandedCard(id: UniqueIdentifier) {
  const selector = `.planning-card[data-task-id="${CSS_ESCAPE(String(id))}"]:not(.drag-overlay-card)`;
  return document.querySelector<HTMLElement>(selector);
}

const CSS_ESCAPE = (value: string) =>
  typeof window !== "undefined" && window.CSS?.escape ? window.CSS.escape(value) : value;

/**
 * Dropped onto another day: the card now lives in a different column, so the
 * lifted copy glides onto that new card (position and size) and hands over.
 */
const otherDayDropAnimation: DropAnimationFunction = ({ active, dragOverlay, transform }) => {
  const overlay = dragOverlay.node;

  const land = (target: HTMLElement | null) => {
    const from = overlay.getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    overlay.classList.add("is-dropping");

    if (!target || !to || to.width === 0 || from.width === 0) {
      return overlay
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" })
        .finished.then(() => undefined, () => undefined);
    }

    // Hide the real card until the copy has landed exactly on it.
    target.style.visibility = "hidden";
    // Its hover buttons only stay if the card lands under the cursor.
    const underCursor =
      lastPointer !== null &&
      lastPointer.x >= to.left &&
      lastPointer.x <= to.right &&
      lastPointer.y >= to.top &&
      lastPointer.y <= to.bottom;
    if (!underCursor) overlay.classList.add("is-landing-away");
    const finalTransform = CSS.Transform.toString({
      x: transform.x + (to.left - from.left),
      y: transform.y + (to.top - from.top),
      scaleX: to.width / from.width,
      scaleY: to.height / from.height,
    });
    overlay.style.transformOrigin = "0 0";
    const animation = overlay.animate(
      [{ transform: CSS.Transform.toString(transform) }, { transform: finalTransform }],
      { duration: OTHER_DAY_DURATION, easing: OTHER_DAY_EASING, fill: "forwards" }
    );
    return animation.finished.then(
      () => {
        target.style.visibility = "";
      },
      () => {
        target.style.visibility = "";
      }
    );
  };

  const target = findLandedCard(active.id);
  if (target) return land(target);
  // The moved card renders a moment later.
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      land(findLandedCard(active.id)).then(resolve);
    });
  });
};

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const calendarCollision = pointerCollisions.find(
    (collision) => collision.id === "calendar-dropzone" || collision.id === CALENDAR_PEEK_ID
  );

  if (calendarCollision) {
    return [calendarCollision];
  }

  // Desktop: the pointer decides the day column; inside it, the nearest task
  // of that day. An empty day takes the drop on the column itself.
  const dayCollision = pointerCollisions.find((collision) => dateFromDayDropId(collision.id));
  if (dayCollision) {
    const listId = dayListId(dateFromDayDropId(dayCollision.id)!);
    const inDay = args.droppableContainers.filter(
      (container) => container.data.current?.sortable?.containerId === listId
    );
    if (inDay.length === 0) return [dayCollision];
    return closestCenter({ ...args, droppableContainers: inDay });
  }

  return closestCenter(args);
};

export default function DndWrapper({ children }: DndWrapperProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<"slot" | "calendar" | "otherDay">("slot");
  const lastPointerY = useRef<number | null>(null);

  // The calendar scrolls itself near its edges (CalendarEdgeScroll), so
  // dnd-kit's own auto-scroll stays out of it.
  const autoScroll = useMemo(
    () => ({ canScroll: (element: Element) => !element.classList.contains("calendar-scroll") }),
    []
  );
  const tasks = useTaskStore((state) => state.tasks);

  // Mouse: drag the whole card after a few pixels, so plain clicks still work.
  // Touch: press and hold briefly, so swiping and scrolling never pick up a card.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  );

  const activeTask = activeId
    ? tasks.find((task) => task.id === activeId) || null
    : null;

  // Follow the pointer for the whole drag; the listeners go away with it.
  useEffect(() => {
    if (activeId === null) return undefined;
    const track = (event: Event) => {
      const point = getClientCoordinates(event);
      if (!point) return;
      lastPointerY.current = point.clientY;
      lastPointer = { x: point.clientX, y: point.clientY };
    };
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("touchmove", track, { passive: true });
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("touchmove", track);
    };
  }, [activeId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    lastPointerY.current = null;
    lastPointer = null;
    overlayCopy = null;
    setActiveId(event.active.id);
    setOverlayWidth(event.active.rect.current.initial?.width ?? null);
    setDropTarget("slot");
    haptic("medium");
  }, []);

  // Decided while hovering, so the drop animation is already chosen on release.
  // Another day: the card is then rendered in a different column, so it
  // glides there instead of back to its old slot.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const targetDate = getDropDate(event.over);
    const sourceDate = getSourceDate(event.active);
    const isPhone = window.matchMedia("(max-width: 767px)").matches;
    if (event.over?.id === "calendar-dropzone") {
      setDropTarget("calendar");
    } else if (!isPhone && targetDate !== null && sourceDate !== null && targetDate !== sourceDate) {
      setDropTarget("otherDay");
    } else {
      setDropTarget("slot");
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;
      haptic("light");

      if (over.id === "calendar-dropzone") {
        const calendarData = over.data?.current as
          | {
              getTimeRangeFromClientY?: (
                clientY: number
              ) => { scheduledDate: string; startTime: string; endTime: string } | null;
            }
          | undefined;
        const startPoint = getClientCoordinates(event.activatorEvent);
        // The finger's real position: dnd-kit's delta also counts scrolling,
        // which is off once the calendar sheet opens mid-drag on phones.
        const dropY =
          lastPointerY.current ?? (startPoint ? startPoint.clientY + event.delta.y : null);

        if (calendarData?.getTimeRangeFromClientY && dropY !== null) {
          const times = calendarData.getTimeRangeFromClientY(dropY);

          if (times) {
            const task = tasks.find((item) => item.id === active.id);
            if (task) {
              const plannedTime = task.plannedTime && task.plannedTime > 0 ? task.plannedTime : 60;
              const startDate = new Date(times.startTime);
              const endTime = new Date(
                startDate.getTime() + plannedTime * 60 * 1000
              ).toISOString();

              useTaskStore.getState().updateTask(task.id, {
                scheduledDate: times.scheduledDate,
                scheduledStart: times.startTime,
                scheduledEnd: endTime,
                plannedTime,
                isBacklog: false,
                backlogBucket: undefined,
                backlogFolder: undefined,
              });
              useUIStore.getState().setCalendarPlanningTaskId(task.id);
            }
          }
        }

        return;
      }

      const isPhone = window.matchMedia("(max-width: 767px)").matches;

      // Desktop: dropped into another day's column.
      const movedTask = tasks.find((item) => item.id === active.id);
      const targetDate = getDropDate(over);
      if (!isPhone && movedTask && targetDate && targetDate !== movedTask.scheduledDate) {
        moveTaskToDay(movedTask, targetDate, over, tasks, lastPointerY.current);
        return;
      }
      if (dateFromDayDropId(over.id)) return;

      // On phones the calendar sheet covers the list, so there is nothing to reorder.
      const sheetCoversList = useUIStore.getState().calendarVisible && isPhone;

      if (active.id !== over.id && !sheetCoversList) {
        const sortableData = active.data?.current?.sortable;
        const overSortable = over.data?.current?.sortable;

        if (sortableData && overSortable) {
          const oldIndex = sortableData.index;
          const newIndex = overSortable.index;

          const dayTasks = tasks
            .filter((task) => {
              const currentTask = tasks.find((item) => item.id === active.id);
              return (
                task.scheduledDate === currentTask?.scheduledDate &&
                !task.isBacklog
              );
            })
            .sort((first, second) => first.position - second.position);

          const reordered = arrayMove(dayTasks, oldIndex, newIndex);
          useTaskStore.getState().reorderTasks(reordered.map((task) => task.id));
        }
      }
    },
    [tasks]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      autoScroll={autoScroll}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      <CalendarEdgeScroll pointerY={lastPointerY} />

      <DragOverlay
        dropAnimation={
          dropTarget === "calendar"
            ? calendarDropAnimation
            : dropTarget === "otherDay"
              ? otherDayDropAnimation
              : dropAnimation
        }
      >
        {activeTask ? <DragOverlayCard task={activeTask} width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * While a task is dragged, scrolls the calendar when the finger nears its
 * visible top or bottom edge. On phones the sheet opens under a finger resting
 * on its header, so this only starts once the finger has been in the grid.
 */
function CalendarEdgeScroll({ pointerY }: { pointerY: { readonly current: number | null } }) {
  const { active, measureDroppableContainers } = useDndContext();
  const dragging = active !== null;

  useEffect(() => {
    if (!dragging) return undefined;
    let armed = false;
    let frame = 0;
    let lastMeasure = 0;
    let needsMeasure = false;

    const tick = (now: number) => {
      const scroller = document.querySelector<HTMLElement>(".calendar-scroll");
      const y = pointerY.current;
      if (scroller && y !== null) {
        if (!armed) armed = isInsideScrollerBody(scroller, y);
        const step = armed ? edgeScrollStep(scroller, y) : 0;
        if (step !== 0) {
          scroller.scrollTop += step;
          needsMeasure = true;
        }
        // Keep the drop zone's rect in step with the scrolled grid.
        if (needsMeasure && (step === 0 || now - lastMeasure > 120)) {
          measureDroppableContainers(["calendar-dropzone"]);
          lastMeasure = now;
          needsMeasure = step !== 0;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, measureDroppableContainers, pointerY]);

  return null;
}

/** Copy of the dragged card, made at pickup. Only one drag runs at a time. */
let overlayCopy: HTMLElement | null = null;

/**
 * The card under the finger/cursor: an exact copy of the real card, lifted.
 * Being identical (time chip, subtasks, height) is what lets the drop land
 * without a visible swap at the end.
 */
function DragOverlayCard({ task, width }: { task: Task; width: number | null }) {
  const { activeNode } = useDndContext();
  const hostRef = useRef<HTMLDivElement>(null);
  // On release dnd-kit mounts this again without the drag context (no
  // activeNode), so the copy made at pickup is kept and shown again.
  const [copy] = useState(() => {
    if (activeNode) {
      const node = activeNode.cloneNode(true) as HTMLElement;
      node.classList.remove("is-drag-placeholder", "is-revealed");
      node.classList.add("drag-overlay-card");
      node.removeAttribute("style");
      node.removeAttribute("id");
      node.querySelectorAll("[id]").forEach((child) => child.removeAttribute("id"));
      overlayCopy = node;
      return node;
    }
    return overlayCopy;
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !copy) return undefined;
    host.replaceChildren(copy);
    return () => host.replaceChildren();
  }, [copy]);

  if (copy) {
    return <div ref={hostRef} style={{ width: width ?? undefined }} />;
  }

  return <FallbackOverlayCard task={task} width={width} />;
}

function FallbackOverlayCard({ task, width }: { task: Task; width: number | null }) {
  const minutes = task.plannedTime && task.plannedTime > 0 ? task.plannedTime : 60;
  const duration = `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, "0")}`;

  return (
    <div className="planning-card drag-overlay-card" style={{ width: width ?? 300 }}>
      <div className="planning-card__meta">
        <span className="planning-card__meta-spacer" aria-hidden="true" />
        <span className="planning-card__duration">{duration}</span>
      </div>
      <div className="planning-card__body">
        <p
          className="planning-card__title"
          style={task.status === "COMPLETED" ? { textDecoration: "line-through" } : undefined}
        >
          {task.title}
        </p>
      </div>
      <div className="planning-card__footer">
        <span className="planning-card__toggle" aria-hidden="true" />
        {task.channel && (
          <span className="planning-card__tag" style={{ color: task.channel.color }}>
            #{task.channel.name}
          </span>
        )}
      </div>
    </div>
  );
}

export { SortableContext, verticalListSortingStrategy };

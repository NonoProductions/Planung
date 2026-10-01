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
import { CALENDAR_PEEK_ID } from "@/components/calendar/MobileCalendarPeek";

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

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const calendarCollision = pointerCollisions.find(
    (collision) => collision.id === "calendar-dropzone" || collision.id === CALENDAR_PEEK_ID
  );

  if (calendarCollision) {
    return [calendarCollision];
  }

  return closestCenter(args);
};

export default function DndWrapper({ children }: DndWrapperProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [overCalendar, setOverCalendar] = useState(false);
  const lastPointerY = useRef<number | null>(null);
  const calendarScrollArmed = useRef(false);

  // The phone calendar sheet opens under a finger resting on its header, which
  // dnd-kit reads as "scroll up". Only let it auto-scroll once the finger has
  // been inside the time grid, so the day stays near the current time.
  const autoScroll = useMemo(
    () => ({
      canScroll: (element: Element) => {
        if (!element.classList.contains("calendar-scroll")) return true;
        if (calendarScrollArmed.current) return true;
        const y = lastPointerY.current;
        const rect = element.getBoundingClientRect();
        if (y !== null && y > rect.top + 48 && y < rect.bottom - 48) {
          calendarScrollArmed.current = true;
        }
        return calendarScrollArmed.current;
      },
    }),
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
      if (point) lastPointerY.current = point.clientY;
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
    calendarScrollArmed.current = false;
    overlayCopy = null;
    setActiveId(event.active.id);
    setOverlayWidth(event.active.rect.current.initial?.width ?? null);
    setOverCalendar(false);
    haptic("medium");
  }, []);

  // Decided while hovering, so the drop animation is already chosen on release.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverCalendar(event.over?.id === "calendar-dropzone");
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

      // On phones the calendar sheet covers the list, so there is nothing to reorder.
      const sheetCoversList =
        useUIStore.getState().calendarVisible &&
        window.matchMedia("(max-width: 767px)").matches;

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

      <DragOverlay dropAnimation={overCalendar ? calendarDropAnimation : dropAnimation}>
        {activeTask ? <DragOverlayCard task={activeTask} width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  );
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

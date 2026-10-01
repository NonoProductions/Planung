"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task } from "@/types";
import { haptic } from "@/lib/haptics";

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

/** The lifted card settles back into its slot instead of vanishing. */
const dropAnimation: DropAnimation = {
  duration: 200,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const calendarCollision = pointerCollisions.find(
    (collision) => collision.id === "calendar-dropzone"
  );

  if (calendarCollision) {
    return [calendarCollision];
  }

  return closestCenter(args);
};

export default function DndWrapper({ children }: DndWrapperProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
    setOverlayWidth(event.active.rect.current.initial?.width ?? null);
    haptic("medium");
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

        if (calendarData?.getTimeRangeFromClientY && startPoint) {
          const dropY = startPoint.clientY + event.delta.y;
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

      if (active.id !== over.id) {
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? <DragOverlayCard task={activeTask} width={overlayWidth} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** The card under the finger/cursor: the real card's look, lifted. */
function DragOverlayCard({ task, width }: { task: Task; width: number | null }) {
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

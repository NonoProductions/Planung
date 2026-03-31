"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
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
  const tasks = useTaskStore((state) => state.tasks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeTask = activeId
    ? tasks.find((task) => task.id === activeId) || null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

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
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {activeTask ? <DragOverlayCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragOverlayCard({ task }: { task: Task }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-lg"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--accent-primary)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        width: 300,
        opacity: 0.9,
      }}
    >
      <div
        className="h-5 w-5 shrink-0 rounded-full border-2"
        style={{
          borderColor: task.channel?.color || "var(--border-color)",
          backgroundColor:
            task.status === "COMPLETED" ? "var(--accent-success)" : "transparent",
        }}
      />
      <span
        className="flex-1 truncate text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {task.title}
      </span>
      {task.channel && (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: task.channel.color + "18",
            color: task.channel.color,
          }}
        >
          #{task.channel.name}
        </span>
      )}
    </div>
  );
}

export { SortableContext, verticalListSortingStrategy };

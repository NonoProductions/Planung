"use client";

import { useCallback, useMemo, useState } from "react";
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
import { toLocalDateTimeString } from "@/lib/date";
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

const CALENDAR_START_HOUR = 6;
const CALENDAR_HOUR_HEIGHT = 72;

function scheduleTaskOnCalendar(
  taskId: string,
  tasks: Task[],
  clientY: number
): boolean {
  const grid = document.querySelector(".calendar-grid") as HTMLElement | null;
  if (!grid) return false;

  const rect = grid.getBoundingClientRect();
  const scrollContainer = grid.closest(".calendar-scroll") as HTMLElement | null;
  const scrollTop = scrollContainer?.scrollTop || 0;
  const y = clientY - rect.top + scrollTop;

  if (y < 0) return false;

  const totalMinutes = Math.round((y / CALENDAR_HOUR_HEIGHT) * 60);
  const snapped = Math.round(totalMinutes / 15) * 15;
  const hour = CALENDAR_START_HOUR + Math.floor(snapped / 60);
  const minute = snapped % 60;

  if (hour < CALENDAR_START_HOUR || hour >= 22) return false;

  const selectedDate = useUIStore.getState().selectedDate;
  const timeStr = `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
  const startDate = new Date(`${selectedDate}T${timeStr}:00`);
  if (isNaN(startDate.getTime())) return false;

  const task = tasks.find((t) => t.id === taskId);
  if (!task) return false;

  const plannedTime =
    task.plannedTime && task.plannedTime > 0 ? task.plannedTime : 60;
  const endTime = toLocalDateTimeString(new Date(
    startDate.getTime() + plannedTime * 60 * 1000
  ));

  useTaskStore.getState().updateTask(task.id, {
    scheduledDate: selectedDate,
    scheduledStart: toLocalDateTimeString(startDate),
    scheduledEnd: endTime,
    plannedTime,
    isBacklog: false,
    backlogBucket: undefined,
    backlogFolder: undefined,
  });
  useUIStore.getState().setCalendarPlanningTaskId(task.id);
  return true;
}

function isPointerInCalendarGrid(clientX: number, clientY: number): boolean {
  const grid = document.querySelector(".calendar-grid") as HTMLElement | null;
  if (!grid) return false;
  const rect = grid.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
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
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const allTasks = useMemo(
    () => [...tasks, ...backlogTasks],
    [backlogTasks, tasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeTask = activeId
    ? allTasks.find((task) => task.id === activeId) || null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
    // Auto-open calendar sidebar so the drop zone is available
    if (!useUIStore.getState().calendarVisible) {
      useUIStore.getState().setCalendarVisible(true);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      const startPoint = getClientCoordinates(event.activatorEvent);
      const dropX = startPoint ? startPoint.clientX + event.delta.x : 0;
      const dropY = startPoint ? startPoint.clientY + event.delta.y : 0;

      // 1) Calendar drop — always use DOM-based detection for reliability.
      //    dnd-kit droppable measurement can be stale when the calendar opens
      //    mid-drag, so we query the actual DOM element directly.
      if (startPoint && isPointerInCalendarGrid(dropX, dropY)) {
        scheduleTaskOnCalendar(active.id as string, allTasks, dropY);
        return;
      }

      // 2) Sorting within task list
      if (!over || active.id === over.id) return;

      const sortableData = active.data?.current?.sortable;
      const overSortable = over.data?.current?.sortable;

      if (sortableData && overSortable) {
        const currentTask = allTasks.find((item) => item.id === active.id);
        if (!currentTask || currentTask.isBacklog) return;

        const oldIndex = sortableData.index;
        const newIndex = overSortable.index;

        const dayTasks = tasks
          .filter((task) => {
            return (
              task.scheduledDate === currentTask?.scheduledDate &&
              !task.isBacklog
            );
          })
          .sort((first, second) => first.position - second.position);

        const reordered = arrayMove(dayTasks, oldIndex, newIndex);
        useTaskStore.getState().reorderTasks(reordered.map((task) => task.id));
      }
    },
    [allTasks, tasks]
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

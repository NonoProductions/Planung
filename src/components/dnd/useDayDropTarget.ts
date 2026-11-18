"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import { dayDropId, getDropDate, getSourceDate } from "@/lib/dayDrop";

/**
 * Makes a whole day column take tasks dragged from another day (desktop only).
 * `isDropTarget` is true while such a task hovers over this day.
 */
export function useDayDropTarget(date: string, enabled: boolean) {
  const { setNodeRef } = useDroppable({ id: dayDropId(date), disabled: !enabled });
  const { active, over } = useDndContext();
  const sourceDate = getSourceDate(active);
  const isDropTarget =
    enabled && sourceDate !== null && sourceDate !== date && getDropDate(over) === date;

  return { setNodeRef, isDropTarget };
}

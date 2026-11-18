import type { Active, Over } from "@dnd-kit/core";

/** Droppable id of a whole day column (desktop only). */
const DAY_DROP_PREFIX = "day:";
/** SortableContext id of a day's task list. */
const DAY_LIST_PREFIX = "day-list:";

export const dayDropId = (date: string) => `${DAY_DROP_PREFIX}${date}`;
export const dayListId = (date: string) => `${DAY_LIST_PREFIX}${date}`;

export function dateFromDayDropId(id: string | number): string | null {
  const value = String(id);
  return value.startsWith(DAY_DROP_PREFIX) ? value.slice(DAY_DROP_PREFIX.length) : null;
}

/** The day a drag is over: either the column itself or a task inside its list. */
export function getDropDate(over: Over | null): string | null {
  if (!over) return null;
  const fromColumn = dateFromDayDropId(over.id);
  if (fromColumn) return fromColumn;
  const containerId = over.data.current?.sortable?.containerId;
  if (typeof containerId === "string" && containerId.startsWith(DAY_LIST_PREFIX)) {
    return containerId.slice(DAY_LIST_PREFIX.length);
  }
  return null;
}

/** The day the dragged task comes from. */
export function getSourceDate(active: Active | null): string | null {
  const containerId = active?.data.current?.sortable?.containerId;
  if (typeof containerId === "string" && containerId.startsWith(DAY_LIST_PREFIX)) {
    return containerId.slice(DAY_LIST_PREFIX.length);
  }
  return null;
}

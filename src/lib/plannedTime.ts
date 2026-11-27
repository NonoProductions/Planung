import type { Task } from "@/types";

/** Planned minutes still ahead: ticked-off tasks no longer count. */
export function remainingPlannedMinutes(tasks: Task[]): number {
  return tasks.reduce(
    (sum, task) => (task.status === "COMPLETED" ? sum : sum + (task.plannedTime || 0)),
    0
  );
}

"use client";

import { addDays, parseISO, subDays } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toLocalDateString } from "@/lib/date";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task } from "@/types";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    Boolean((target as HTMLElement | null)?.isContentEditable)
  );
}

function findTaskById(
  tasks: Task[],
  backlogTasks: Task[],
  taskId: string | null
) {
  if (!taskId) return null;

  return (
    tasks.find((task) => task.id === taskId) ??
    backlogTasks.find((task) => task.id === taskId) ??
    null
  );
}

function resolveActionTask(
  pathname: string,
  selectedDate: string,
  selectedTaskId: string | null,
  tasks: Task[],
  backlogTasks: Task[]
) {
  const selectedTask = findTaskById(tasks, backlogTasks, selectedTaskId);

  if (selectedTask) {
    return selectedTask;
  }

  if (pathname.startsWith("/backlog")) {
    return backlogTasks[0] ?? null;
  }

  const dayTasks = tasks
    .filter((task) => task.scheduledDate === selectedDate && !task.isBacklog)
    .sort((first, second) => first.position - second.position);

  return dayTasks[0] ?? null;
}

function resolveBacklogQuickAddTarget(task: Task | null) {
  if (!task?.isBacklog) return "this_week";
  if (task.backlogFolder) return `folder:${task.backlogFolder}`;
  return task.backlogBucket || "this_week";
}

function supportsCalendar(pathname: string) {
  return pathname === "/" || pathname.startsWith("/backlog");
}

export default function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  const tasks = useTaskStore((state) => state.tasks);
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const toggleTaskStatus = useTaskStore((state) => state.toggleTaskStatus);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const selectedDate = useUIStore((state) => state.selectedDate);
  const selectedTaskId = useUIStore((state) => state.selectedTaskId);
  const editingTaskId = useUIStore((state) => state.editingTaskId);
  const shutdownRitualOpen = useUIStore((state) => state.shutdownRitualOpen);
  const shortcutHelpOpen = useUIStore((state) => state.shortcutHelpOpen);
  const focusTaskId = useUIStore((state) => state.focusTaskId);
  const quickAddRequest = useUIStore((state) => state.quickAddRequest);
  const setSelectedDate = useUIStore((state) => state.setSelectedDate);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const toggleCalendar = useUIStore((state) => state.toggleCalendar);
  const closeShutdownRitual = useUIStore((state) => state.closeShutdownRitual);
  const openShortcutHelp = useUIStore((state) => state.openShortcutHelp);
  const closeShortcutHelp = useUIStore((state) => state.closeShortcutHelp);
  const openFocusMode = useUIStore((state) => state.openFocusMode);
  const closeFocusMode = useUIStore((state) => state.closeFocusMode);
  const requestDayQuickAdd = useUIStore((state) => state.requestDayQuickAdd);
  const requestBacklogQuickAdd = useUIStore(
    (state) => state.requestBacklogQuickAdd
  );
  const clearQuickAddRequest = useUIStore((state) => state.clearQuickAddRequest);
  const startEditingTask = useUIStore((state) => state.startEditingTask);
  const stopEditingTask = useUIStore((state) => state.stopEditingTask);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const noCtrlMetaAlt = !event.ctrlKey && !event.metaKey && !event.altKey;
      const key = event.key;
      const normalizedKey = key.toLowerCase();
      const boardRoute = pathname.startsWith("/planning") ? "/planning" : "/";
      const selectedTask = findTaskById(tasks, backlogTasks, selectedTaskId);
      const focusTask = selectedTask ?? resolveActionTask(
        pathname,
        selectedDate,
        null,
        tasks,
        backlogTasks
      );

      const shortcutHelpPressed =
        key === "?" || (ctrlOrMeta && (key === "/" || key === "?"));

      if (typing && shortcutHelpPressed) {
        return;
      }

      if (shortcutHelpPressed) {
        event.preventDefault();
        if (shortcutHelpOpen) {
          closeShortcutHelp();
        } else {
          openShortcutHelp();
        }
        return;
      }

      if (key === "Escape") {
        if (shortcutHelpOpen) {
          event.preventDefault();
          closeShortcutHelp();
          return;
        }

        if (focusTaskId) {
          event.preventDefault();
          closeFocusMode();
          return;
        }

        if (shutdownRitualOpen) {
          event.preventDefault();
          closeShutdownRitual();
          return;
        }

        if (editingTaskId) {
          event.preventDefault();
          stopEditingTask();
          return;
        }

        if (quickAddRequest) {
          event.preventDefault();
          clearQuickAddRequest();
        }

        return;
      }

      if (typing || event.repeat) return;

      if (
        shortcutHelpOpen ||
        focusTaskId !== null ||
        shutdownRitualOpen ||
        editingTaskId !== null ||
        quickAddRequest !== null
      ) {
        return;
      }

      if (event.shiftKey && noCtrlMetaAlt && normalizedKey === "l") {
        event.preventDefault();
        toggleDarkMode();
        return;
      }

      if (event.shiftKey && noCtrlMetaAlt && normalizedKey === "c") {
        if (!supportsCalendar(pathname)) return;
        event.preventDefault();
        toggleCalendar();
        return;
      }

      if (!noCtrlMetaAlt || event.shiftKey) {
        return;
      }

      if (key === "ArrowLeft") {
        event.preventDefault();
        router.push(boardRoute);
        setSelectedDate(toLocalDateString(subDays(parseISO(selectedDate), 1)));
        return;
      }

      if (key === "ArrowRight") {
        event.preventDefault();
        router.push(boardRoute);
        setSelectedDate(toLocalDateString(addDays(parseISO(selectedDate), 1)));
        return;
      }

      if (/^[1-9]$/.test(key) && selectedTask) {
        event.preventDefault();
        void updateTask(selectedTask.id, { plannedTime: Number(key) * 60 });
        return;
      }

      if (key === "Backspace" && selectedTask) {
        event.preventDefault();
        void deleteTask(selectedTask.id);
        return;
      }

      if (normalizedKey === "a") {
        event.preventDefault();

        if (pathname.startsWith("/backlog")) {
          requestBacklogQuickAdd(resolveBacklogQuickAddTarget(selectedTask));
          return;
        }

        router.push("/");
        requestDayQuickAdd(selectedDate);
        return;
      }

      if (normalizedKey === "p") {
        event.preventDefault();
        router.push("/planning");
        return;
      }

      if (normalizedKey === "f" && focusTask) {
        event.preventDefault();
        openFocusMode(focusTask.id);
        return;
      }

      if (normalizedKey === "t") {
        event.preventDefault();
        router.push(boardRoute);
        setSelectedDate(toLocalDateString(new Date()));
        return;
      }

      if (normalizedKey === "e" && selectedTask) {
        event.preventDefault();
        startEditingTask(selectedTask.id);
        return;
      }

      if (normalizedKey === "d" && selectedTask) {
        event.preventDefault();
        toggleTaskStatus(selectedTask.id);
        return;
      }

      if (normalizedKey === "b") {
        event.preventDefault();
        router.push("/backlog");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    backlogTasks,
    clearQuickAddRequest,
    closeFocusMode,
    closeShortcutHelp,
    closeShutdownRitual,
    deleteTask,
    editingTaskId,
    focusTaskId,
    openFocusMode,
    openShortcutHelp,
    pathname,
    quickAddRequest,
    requestBacklogQuickAdd,
    requestDayQuickAdd,
    router,
    selectedDate,
    selectedTaskId,
    setSelectedDate,
    shortcutHelpOpen,
    shutdownRitualOpen,
    startEditingTask,
    stopEditingTask,
    tasks,
    toggleCalendar,
    toggleDarkMode,
    toggleTaskStatus,
    updateTask,
  ]);
}

"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion } from "framer-motion";
import { CalendarPlus, Check, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale";
import type { Channel, Task } from "@/types";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import DonutTimer from "@/components/ui/DonutTimer";
import { toLocalDateString } from "@/lib/date";

interface BacklogTaskCardProps {
  task: Task;
}

function formatPlannedTime(minutes?: number) {
  if (!minutes || minutes <= 0) return null;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  return `${minutes}m`;
}

export default function BacklogTaskCard({ task }: BacklogTaskCardProps) {
  const toggleTaskStatus = useTaskStore((state) => state.toggleTaskStatus);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const scheduleBacklogTask = useTaskStore(
    (state) => state.scheduleBacklogTask
  );
  const channels = useTaskStore((state) => state.channels);
  const selectedTaskId = useUIStore((state) => state.selectedTaskId);
  const editingTaskId = useUIStore((state) => state.editingTaskId);
  const selectTask = useUIStore((state) => state.selectTask);
  const startEditingTask = useUIStore((state) => state.startEditingTask);
  const stopEditingTask = useUIStore((state) => state.stopEditingTask);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const editing = editingTaskId === task.id;
  const isSelected = selectedTaskId === task.id;
  const isCompleted = task.status === "COMPLETED";
  const channelColor = task.channel?.color || "var(--border-color)";

  useEffect(() => {
    if (!showSchedule) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSchedule(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showSchedule]);

  const quickScheduleDays = [
    { label: "Heute", date: new Date() },
    { label: "Morgen", date: addDays(new Date(), 1) },
    { label: "Uebermorgen", date: addDays(new Date(), 2) },
  ];

  if (editing) {
    return (
      <EditableBacklogTaskCard
        task={task}
        channels={channels}
        sortableStyle={sortableStyle}
        setNodeRef={setNodeRef}
        updateTask={updateTask}
        selectTask={selectTask}
        stopEditingTask={stopEditingTask}
      />
    );
  }

  const handleDelete = () => {
    if (confirmDelete) {
      void deleteTask(task.id);
      return;
    }

    setConfirmDelete(true);
    window.setTimeout(() => setConfirmDelete(false), 3000);
  };

  const hasMeta = Boolean(task.channel) || Boolean(formatPlannedTime(task.plannedTime));

  return (
    <motion.div
      ref={setNodeRef}
      layout
      onClick={() => selectTask(task.id)}
      className="group relative flex items-center gap-3 rounded-[8px] border px-3.5 py-2.5 transition-all duration-200"
      aria-selected={isSelected}
      style={{
        ...sortableStyle,
        backgroundColor: isSelected ? "rgba(249, 246, 255, 0.9)" : "#ffffff",
        borderColor: isSelected
          ? "rgba(141, 124, 246, 0.74)"
          : isCompleted
            ? "var(--border-subtle)"
            : "#e4ddd6",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(141, 124, 246, 0.18), 0 14px 30px rgba(141, 124, 246, 0.1)"
          : "0 1px 0 rgba(89, 72, 48, 0.04)",
        opacity: isDragging ? 0.4 : isCompleted ? 0.65 : 1,
      }}
      whileHover={{
        boxShadow: isSelected
          ? "0 0 0 1px rgba(141, 124, 246, 0.18), 0 18px 34px rgba(141, 124, 246, 0.12)"
          : "0 6px 14px rgba(89, 72, 48, 0.05)",
      }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className="-ml-1 flex h-5 w-4 shrink-0 cursor-grab items-center justify-center opacity-60 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-50 touch-none"
        style={{ color: "var(--text-muted)" }}
        aria-label="Ziehen"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} strokeWidth={1.8} />
      </button>

      <button
        onClick={() => toggleTaskStatus(task.id)}
        className="relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200"
        style={{
          borderColor: isCompleted ? "var(--accent-success)" : channelColor,
          backgroundColor: isCompleted ? "var(--accent-success)" : "transparent",
        }}
        onMouseEnter={(event) => {
          if (!isCompleted) {
            event.currentTarget.style.borderColor = "var(--accent-success)";
            event.currentTarget.style.backgroundColor =
              "var(--accent-success-light)";
            event.currentTarget.style.transform = "scale(1.12)";
          }
        }}
        onMouseLeave={(event) => {
          if (!isCompleted) {
            event.currentTarget.style.borderColor = channelColor;
            event.currentTarget.style.backgroundColor = "transparent";
            event.currentTarget.style.transform = "scale(1)";
          }
        }}
        aria-label={isCompleted ? "Als offen markieren" : "Als erledigt markieren"}
      >
        {isCompleted && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 22 }}
          >
            <Check size={10} strokeWidth={3} className="text-white" />
          </motion.div>
        )}
      </button>

      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 overflow-hidden"
        onDoubleClick={() => startEditingTask(task.id)}
      >
        <span
          className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug transition-all duration-300"
          style={{
            color: isCompleted ? "var(--text-muted)" : "var(--text-primary)",
            textDecoration: isCompleted ? "line-through" : "none",
            textDecorationColor: isCompleted
              ? "var(--text-muted)"
              : "transparent",
            textDecorationThickness: "1.5px",
            letterSpacing: "-0.02em",
          }}
        >
          {task.title}
        </span>

        {hasMeta && (
          <div className="flex shrink-0 items-center gap-1.5">
            {task.channel && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight tracking-tight"
                style={{
                  backgroundColor: `${task.channel.color}14`,
                  color: task.channel.color,
                }}
              >
                #{task.channel.name}
              </span>
            )}
            {formatPlannedTime(task.plannedTime) && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: "rgba(244, 239, 232, 0.85)",
                  color: "var(--text-secondary)",
                }}
              >
                {formatPlannedTime(task.plannedTime)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowSchedule((current) => !current);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md opacity-70 transition-all duration-150 hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = "var(--accent-primary)";
              event.currentTarget.style.backgroundColor = "var(--accent-glow)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = "var(--text-muted)";
              event.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label="Einplanen"
            title="Einplanen"
          >
            <CalendarPlus size={14} strokeWidth={1.9} />
          </button>

          {showSchedule && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border"
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--border-color)",
                boxShadow: "var(--shadow-lg)",
                minWidth: 180,
              }}
            >
              {quickScheduleDays.map((day) => (
                <button
                  key={day.label}
                  onClick={(event) => {
                    event.stopPropagation();
                    void scheduleBacklogTask(task.id, toLocalDateString(day.date));
                    setShowSchedule(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium transition-colors duration-100"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    event.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent";
                    event.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  <span>{day.label}</span>
                  <span
                    className="ml-auto text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {format(day.date, "EEE d. MMM", { locale: de })}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            startEditingTask(task.id);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md opacity-70 transition-all duration-150 hover:opacity-100"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = "var(--accent-primary)";
            event.currentTarget.style.backgroundColor = "var(--accent-glow)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = "var(--text-muted)";
            event.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Bearbeiten"
          title="Bearbeiten"
        >
          <Pencil size={13} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleDelete();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md opacity-70 transition-all duration-150 hover:opacity-100"
          style={{
            color: confirmDelete ? "var(--accent-danger)" : "var(--text-muted)",
            backgroundColor: confirmDelete
              ? "var(--accent-danger-light)"
              : "transparent",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = "var(--accent-danger)";
            event.currentTarget.style.backgroundColor =
              "var(--accent-danger-light)";
          }}
          onMouseLeave={(event) => {
            if (!confirmDelete) {
              event.currentTarget.style.color = "var(--text-muted)";
              event.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          aria-label={
            confirmDelete ? "Klicke nochmal zum Loeschen" : "Loeschen"
          }
          title={confirmDelete ? "Nochmal klicken zum Bestaetigen" : "Loeschen"}
        >
          <Trash2 size={13} strokeWidth={1.9} />
        </button>
      </div>

      {task.plannedTime && (
        <DonutTimer planned={task.plannedTime} actual={task.actualTime} />
      )}
    </motion.div>
  );
}

interface EditableBacklogTaskCardProps {
  task: Task;
  channels: Channel[];
  sortableStyle: CSSProperties;
  setNodeRef: (node: HTMLElement | null) => void;
  updateTask: (
    taskId: string,
    updates: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "status"
        | "plannedTime"
        | "actualTime"
        | "scheduledDate"
        | "scheduledStart"
        | "scheduledEnd"
        | "position"
        | "channelId"
        | "isBacklog"
        | "backlogBucket"
        | "backlogFolder"
      >
    >
  ) => Promise<void>;
  selectTask: (taskId: string | null) => void;
  stopEditingTask: () => void;
}

function EditableBacklogTaskCard({
  task,
  channels,
  sortableStyle,
  setNodeRef,
  updateTask,
  selectTask,
  stopEditingTask,
}: EditableBacklogTaskCardProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editChannelId, setEditChannelId] = useState(task.channelId || "");
  const [editPlannedTime, setEditPlannedTime] = useState(
    task.plannedTime?.toString() || ""
  );
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, []);

  const handleSave = () => {
    if (!editTitle.trim()) return;

    void updateTask(task.id, {
      title: editTitle.trim(),
      channelId: editChannelId || undefined,
      plannedTime: editPlannedTime ? parseInt(editPlannedTime, 10) : undefined,
    });
    stopEditingTask();
  };

  const handleEditKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopEditingTask();
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      layout
      onClick={() => selectTask(task.id)}
      className="flex flex-col gap-3 overflow-hidden rounded-[8px] border p-4"
      style={{
        ...sortableStyle,
        backgroundColor: "#ffffff",
        borderColor: "var(--accent-primary)",
        boxShadow: "var(--shadow-sm), 0 0 0 3px var(--accent-glow)",
      }}
    >
      <input
        ref={editInputRef}
        type="text"
        value={editTitle}
        onChange={(event) => setEditTitle(event.target.value)}
        onKeyDown={handleEditKeyDown}
        className="w-full bg-transparent text-[14px] font-medium outline-none"
        style={{ color: "var(--text-primary)" }}
      />
      <div
        className="flex flex-wrap items-center gap-2 pt-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <select
          value={editChannelId}
          onChange={(event) => setEditChannelId(event.target.value)}
          onKeyDown={handleEditKeyDown}
          className="rounded-lg border px-2.5 py-1.5 text-[11px] font-medium outline-none"
          style={{
            backgroundColor: "var(--bg-input)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <option value="">Kein Kanal</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={editPlannedTime}
          onChange={(event) => setEditPlannedTime(event.target.value)}
          placeholder="Min."
          min={0}
          className="w-[72px] rounded-lg border px-2.5 py-1.5 text-[11px] font-medium outline-none"
          style={{
            backgroundColor: "var(--bg-input)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
          onKeyDown={handleEditKeyDown}
        />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={stopEditingTask}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!editTitle.trim()}
            className="rounded-lg px-3.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-25"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            Speichern
          </button>
        </div>
      </div>
    </motion.div>
  );
}

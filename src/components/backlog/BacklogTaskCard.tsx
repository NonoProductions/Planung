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
  const isCompleted = task.status === "COMPLETED";
  const channelColor = task.channel?.color || "var(--text-secondary)";

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
    { label: "Übermorgen", date: addDays(new Date(), 2) },
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

  const plannedLabel = formatPlannedTime(task.plannedTime);

  return (
    <motion.article
      ref={setNodeRef}
      className="group planning-card"
      style={sortableStyle}
      whileHover={{ boxShadow: "0 4px 12px rgba(var(--shadow-rgb), 0.05)" }}
      transition={{ duration: 0.2 }}
    >
      {plannedLabel && (
        <div className="planning-card__meta">
          <span className="planning-card__meta-spacer" aria-hidden="true" />
          <span className="planning-card__duration">{plannedLabel}</span>
        </div>
      )}

      <div className="planning-card__body">
        <h3
          className="planning-card__title"
          onDoubleClick={() => startEditingTask(task.id)}
          style={{
            textDecoration: isCompleted ? "line-through" : "none",
            opacity: isCompleted ? 0.72 : 1,
          }}
        >
          {task.title}
        </h3>
      </div>

      <div className="planning-card__footer">
        <div className="planning-card__controls">
          <button
            type="button"
            className="planning-card__toggle"
            style={{
              borderColor: isCompleted ? "var(--accent-success)" : "var(--border-color)",
              backgroundColor: isCompleted ? "var(--accent-success-light)" : "transparent",
              color: isCompleted ? "var(--accent-success)" : "var(--text-secondary)",
            }}
            onClick={() => toggleTaskStatus(task.id)}
            aria-label={isCompleted ? "Als offen markieren" : "Als erledigt markieren"}
          >
            {isCompleted && <Check size={14} strokeWidth={2.6} />}
          </button>

          <div className="relative">
            <button
              type="button"
              className="planning-card__ghost-action"
              style={{
                backgroundColor: showSchedule ? "var(--accent-primary-light)" : "var(--surface-sunken)",
                color: showSchedule ? "var(--accent-primary)" : "var(--text-secondary)",
              }}
              onClick={() => setShowSchedule((current) => !current)}
              aria-label="Einplanen"
              title="Einplanen"
            >
              <CalendarPlus size={12} strokeWidth={2} />
            </button>

            {showSchedule && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="popover-panel absolute left-0 top-full z-50 mt-1 overflow-hidden"
                style={{ minWidth: 180 }}
              >
                {quickScheduleDays.map((day) => (
                  <button
                    key={day.label}
                    type="button"
                    onClick={() => {
                      void scheduleBacklogTask(task.id, toLocalDateString(day.date));
                      setShowSchedule(false);
                    }}
                    className="backlog-schedule-option"
                  >
                    <span>{day.label}</span>
                    <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {format(day.date, "EEE d. MMM", { locale: de })}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          <button
            type="button"
            className="planning-card__ghost-action"
            style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-secondary)" }}
            onClick={() => startEditingTask(task.id)}
            aria-label="Bearbeiten"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="planning-card__ghost-action"
            style={{
              backgroundColor: confirmDelete ? "var(--accent-danger-light)" : "var(--surface-sunken)",
              color: confirmDelete ? "var(--accent-danger)" : "var(--text-secondary)",
            }}
            onClick={handleDelete}
            aria-label={confirmDelete ? "Klicke nochmal zum Löschen" : "Löschen"}
            title={confirmDelete ? "Nochmal klicken zum Bestätigen" : "Löschen"}
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="planning-card__ghost-action touch-none"
            style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-secondary)" }}
            {...attributes}
            {...listeners}
            aria-label="Ziehen"
          >
            <GripVertical size={12} />
          </button>
        </div>

        {task.channel && (
          <span className="planning-card__tag" style={{ color: channelColor }}>
            #{task.channel.name}
          </span>
        )}
      </div>
    </motion.article>
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
    <div
      ref={setNodeRef}
      className="planning-card"
      onClick={() => selectTask(task.id)}
      style={{
        ...sortableStyle,
        borderColor: "var(--accent-primary)",
        boxShadow:
          "0 0 0 1px rgba(141, 124, 246, 0.2), 0 16px 36px rgba(var(--shadow-rgb), 0.08)",
      }}
    >
      <input
        ref={editInputRef}
        type="text"
        value={editTitle}
        onChange={(event) => setEditTitle(event.target.value)}
        onKeyDown={handleEditKeyDown}
        className="planning-add-form__input"
        style={{
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
          backgroundColor: "var(--surface-subtle)",
        }}
      />
      <div className="planning-add-form__controls">
        <select
          value={editChannelId}
          onChange={(event) => setEditChannelId(event.target.value)}
          onKeyDown={handleEditKeyDown}
          className="planning-add-form__select"
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
          min={0}
          value={editPlannedTime}
          onChange={(event) => setEditPlannedTime(event.target.value)}
          onKeyDown={handleEditKeyDown}
          placeholder="Min"
          className="planning-add-form__minutes"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!editTitle.trim()}
          className="planning-add-form__save disabled:opacity-40"
          style={{ backgroundColor: "var(--accent-primary)" }}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}

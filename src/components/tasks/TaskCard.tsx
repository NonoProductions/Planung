"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { CalendarClock, Check, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskScheduleForm from "@/components/calendar/TaskScheduleForm";
import type { PopoverAnchor } from "@/components/calendar/CalendarPopover";
import { useTaskStore } from "@/stores/taskStore";
import { haptic } from "@/lib/haptics";
import { useUIStore } from "@/stores/uiStore";
import type { Channel, Task } from "@/types";

interface TaskCardProps {
  task: Task;
}

function formatPlannedTime(minutes?: number) {
  if (!minutes || minutes <= 0) return "1:00";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}`;
}

function formatScheduledWindow(task: Task) {
  if (!task.scheduledStart) return null;

  const start = format(parseISO(task.scheduledStart), "HH:mm");
  if (!task.scheduledEnd) return start;

  return `${start} - ${format(parseISO(task.scheduledEnd), "HH:mm")}`;
}

function getTimeChipColor(task: Task) {
  const channelName = task.channel?.name.toLowerCase() ?? "";

  if (channelName.includes("growth")) return "#ffb54c";
  if (channelName.includes("product")) return "#9d80f8";
  if (channelName.includes("plan")) return "#67b9ea";

  return "#ffb54c";
}

export default function TaskCard({ task }: TaskCardProps) {
  const toggleTaskStatus = useTaskStore((state) => state.toggleTaskStatus);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addSubtask = useTaskStore((state) => state.addSubtask);
  const toggleSubtaskStatus = useTaskStore(
    (state) => state.toggleSubtaskStatus
  );
  const renameSubtask = useTaskStore((state) => state.renameSubtask);
  const reorderSubtasks = useTaskStore((state) => state.reorderSubtasks);
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
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  // Edit/delete/drag only show after tapping the card; a tap anywhere else hides them.
  const [actionsRevealed, setActionsRevealed] = useState(false);
  // "Einplanen": pick a day and time without dragging into the calendar (phones).
  const [scheduleAnchor, setScheduleAnchor] = useState<PopoverAnchor | null>(null);
  const selectedDate = useUIStore((state) => state.selectedDate);
  const cardRef = useRef<HTMLElement | null>(null);
  const editing = editingTaskId === task.id;

  useEffect(() => {
    if (!actionsRevealed) return undefined;
    const hide = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) setActionsRevealed(false);
    };
    document.addEventListener("pointerdown", hide);
    return () => document.removeEventListener("pointerdown", hide);
  }, [actionsRevealed]);
  const isCompleted = task.status === "COMPLETED";
  const channelColor = task.channel?.color || "var(--text-secondary)";
  const hasSubtasks = (task.subtasks?.length ?? 0) > 0;
  const scheduledWindow = formatScheduledWindow(task);

  if (editing) {
    return (
      <EditableTaskCard
        task={task}
        channels={channels}
        sortableStyle={sortableStyle}
        setNodeRef={setNodeRef}
        updateTask={updateTask}
        addSubtask={addSubtask}
        toggleSubtaskStatus={toggleSubtaskStatus}
        renameSubtask={renameSubtask}
        reorderSubtasks={reorderSubtasks}
        selectTask={selectTask}
        stopEditingTask={stopEditingTask}
      />
    );
  }

  return (
    <>
      <motion.article
        ref={(node) => {
          setNodeRef(node);
          cardRef.current = node;
        }}
        className={`group planning-card${actionsRevealed ? " is-revealed" : ""}${
          isDragging ? " is-drag-placeholder" : ""
        }`}
        style={sortableStyle}
        {...attributes}
        {...listeners}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (
            !actionsRevealed &&
            !target.closest(".planning-card__toggle, .planning-card__subtask-toggle")
          ) {
            haptic("select");
            setActionsRevealed(true);
          }
        }}
        whileHover={{ boxShadow: "0 4px 12px rgba(var(--shadow-rgb), 0.05)" }}
        transition={{ duration: 0.2 }}
      >
        <div className="planning-card__meta">
          {scheduledWindow ? (
            <span
              className="planning-card__time-chip"
              style={{ backgroundColor: getTimeChipColor(task) }}
            >
              {scheduledWindow}
            </span>
          ) : (
            <span className="planning-card__meta-spacer" aria-hidden="true" />
          )}
          <span className="planning-card__duration">
            {formatPlannedTime(task.plannedTime)}
          </span>
        </div>

        <div className="planning-card__body">
          <div className="planning-card__header">
            <div className="min-w-0 flex-1">
              <h3
                className="planning-card__title"
                style={{
                  textDecoration: isCompleted ? "line-through" : "none",
                  opacity: isCompleted ? 0.72 : 1,
                }}
              >
                {task.title}
              </h3>
            </div>
          </div>

          {hasSubtasks && (
            <div className="planning-card__subtasks">
              {task.subtasks?.map((subtask) => {
                const subtaskDone = subtask.status === "COMPLETED";
                return (
                  <div key={subtask.id} className="planning-card__subtask">
                    <button
                      type="button"
                      className="planning-card__subtask-toggle"
                      onClick={() => toggleSubtaskStatus(task.id, subtask.id)}
                      style={{
                        borderColor: subtaskDone
                          ? "var(--accent-success)"
                          : "var(--border-color)",
                        backgroundColor: subtaskDone
                          ? "var(--accent-success)"
                          : "transparent",
                        cursor: "pointer",
                      }}
                      aria-label={
                        subtaskDone
                          ? "Mark subtask as open"
                          : "Mark subtask as completed"
                      }
                    >
                      {subtaskDone && (
                        <Check size={9} strokeWidth={3} color="#ffffff" />
                      )}
                    </button>
                    <span
                      className="planning-card__subtask-text"
                      style={{
                        color: subtaskDone
                          ? "var(--text-muted)"
                          : "var(--text-secondary)",
                        textDecoration: subtaskDone ? "line-through" : "none",
                      }}
                    >
                      {subtask.title}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="planning-card__footer">
          <div className="planning-card__controls">
            <button
              className="planning-card__toggle"
              style={{
                borderColor: isCompleted
                  ? "var(--accent-success)"
                  : "var(--border-color)",
                backgroundColor: isCompleted
                  ? "var(--accent-success-light)"
                  : "transparent",
                color: isCompleted
                  ? "var(--accent-success)"
                  : "var(--text-secondary)",
              }}
              onClick={() => toggleTaskStatus(task.id)}
              onDoubleClick={() => startEditingTask(task.id)}
              aria-label={isCompleted ? "Mark as open" : "Mark as completed"}
            >
              {isCompleted && <Check size={14} strokeWidth={2.6} />}
            </button>

            <button
              className="planning-card__ghost-action"
              style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-secondary)" }}
              onClick={() => startEditingTask(task.id)}
              aria-label="Edit"
            >
              <Pencil size={12} strokeWidth={2} />
            </button>

            <button
              className="planning-card__ghost-action"
              style={{
                backgroundColor: confirmDelete
                  ? "var(--accent-danger-light)"
                  : "var(--surface-sunken)",
                color: confirmDelete
                  ? "var(--accent-danger)"
                  : "var(--text-secondary)",
              }}
              onClick={() => {
                if (confirmDelete) {
                  void deleteTask(task.id);
                } else {
                  haptic("light");
                  setConfirmDelete(true);
                  window.setTimeout(() => setConfirmDelete(false), 2400);
                }
              }}
              aria-label="Delete"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>

            <button
              className="planning-card__ghost-action"
              style={{ backgroundColor: "var(--surface-sunken)", color: "var(--text-secondary)" }}
              onClick={(event) => setScheduleAnchor({ x: event.clientX, y: event.clientY })}
              aria-label="Einplanen"
            >
              <CalendarClock size={12} strokeWidth={2} />
            </button>

            <span className="planning-card__grip" aria-hidden="true">
              <GripVertical size={12} />
            </span>
          </div>

          {task.channel && (
            <span className="planning-card__tag" style={{ color: channelColor }}>
              #{task.channel.name}
            </span>
          )}
        </div>
      </motion.article>

      {/* Outside the card, so taps in the form never start dragging the card. */}
      {scheduleAnchor && (
        <TaskScheduleForm
          task={task}
          selectedDate={selectedDate}
          anchor={scheduleAnchor}
          onClose={() => setScheduleAnchor(null)}
          onSave={(data) => {
            haptic("success");
            setScheduleAnchor(null);
            void updateTask(task.id, {
              ...data,
              isBacklog: false,
              backlogBucket: undefined,
              backlogFolder: undefined,
            });
          }}
          onUnschedule={() => {
            setScheduleAnchor(null);
            void updateTask(task.id, { scheduledStart: undefined, scheduledEnd: undefined });
          }}
        />
      )}
    </>
  );
}

interface EditableTaskCardProps {
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
  addSubtask: (parentId: string, title: string) => Promise<void>;
  toggleSubtaskStatus: (parentId: string, subtaskId: string) => Promise<void>;
  renameSubtask: (
    parentId: string,
    subtaskId: string,
    title: string
  ) => Promise<void>;
  reorderSubtasks: (parentId: string, subtaskIds: string[]) => void;
  selectTask: (taskId: string | null) => void;
  stopEditingTask: () => void;
}

function EditableTaskCard({
  task,
  channels,
  sortableStyle,
  setNodeRef,
  updateTask,
  addSubtask,
  toggleSubtaskStatus,
  renameSubtask,
  reorderSubtasks,
  selectTask,
  stopEditingTask,
}: EditableTaskCardProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editChannelId, setEditChannelId] = useState(task.channelId || "");
  const [editPlannedTime, setEditPlannedTime] = useState(
    task.plannedTime?.toString() || ""
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

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

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    subtaskInputRef.current?.focus();
  };

  const startEditingSubtask = (subtask: Task) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const saveSubtaskEdit = async () => {
    if (editingSubtaskId) {
      await renameSubtask(task.id, editingSubtaskId, editingSubtaskTitle);
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !task.subtasks) return;

    const ids = task.subtasks.map((subtask) => subtask.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);

    if (oldIndex === -1 || newIndex === -1) return;
    reorderSubtasks(task.id, arrayMove(ids, oldIndex, newIndex));
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
        ref={inputRef}
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
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--surface-subtle)",
          }}
        >
          <option value="">No channel</option>
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
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--surface-subtle)",
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          className="planning-add-form__save"
          style={{ backgroundColor: "var(--text-secondary)" }}
        >
          Save
        </button>
      </div>

      <DndContext
        sensors={subtaskSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSubtaskDragEnd}
      >
        <SortableContext
          items={task.subtasks?.map((subtask) => subtask.id) ?? []}
          strategy={verticalListSortingStrategy}
        >
          <div className="planning-card__subtasks" style={{ marginTop: 12 }}>
            {task.subtasks &&
              task.subtasks.length > 0 &&
              task.subtasks.map((subtask) => {
                const subtaskDone = subtask.status === "COMPLETED";
                const isEditingThis = editingSubtaskId === subtask.id;

                return (
                  <SortableSubtaskRow key={subtask.id} id={subtask.id}>
                    {(dragHandleProps) => (
                      <>
                        <button
                          type="button"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--text-muted)",
                            cursor: "grab",
                            padding: "0 2px",
                            border: "none",
                            background: "none",
                          }}
                          aria-label="Drag subtask"
                          {...dragHandleProps}
                        >
                          <GripVertical size={11} />
                        </button>
                        <button
                          type="button"
                          className="planning-card__subtask-toggle"
                          onClick={() => toggleSubtaskStatus(task.id, subtask.id)}
                          style={{
                            borderColor: subtaskDone
                              ? "var(--accent-success)"
                              : "var(--border-color)",
                            backgroundColor: subtaskDone
                              ? "var(--accent-success)"
                              : "transparent",
                            cursor: "pointer",
                          }}
                          aria-label={
                            subtaskDone
                              ? "Mark subtask as open"
                              : "Mark subtask as completed"
                          }
                        >
                          {subtaskDone && (
                            <Check size={9} strokeWidth={3} color="#ffffff" />
                          )}
                        </button>
                        {isEditingThis ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingSubtaskTitle}
                            onChange={(event) =>
                              setEditingSubtaskTitle(event.target.value)
                            }
                            onBlur={saveSubtaskEdit}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void saveSubtaskEdit();
                              if (event.key === "Escape") {
                                setEditingSubtaskId(null);
                                setEditingSubtaskTitle("");
                              }
                            }}
                            style={{
                              flex: 1,
                              border: "1px solid var(--border-color)",
                              borderRadius: 4,
                              padding: "2px 6px",
                              fontSize: 12,
                              backgroundColor: "var(--surface-subtle)",
                              color: "var(--text-primary)",
                              outline: "none",
                            }}
                          />
                        ) : (
                          <span
                            className="planning-card__subtask-text"
                            style={{
                              color: subtaskDone
                                ? "var(--text-muted)"
                                : "var(--text-secondary)",
                              textDecoration: subtaskDone
                                ? "line-through"
                                : "none",
                              cursor: "text",
                              flex: 1,
                            }}
                            onClick={() => startEditingSubtask(subtask)}
                          >
                            {subtask.title}
                          </span>
                        )}
                      </>
                    )}
                  </SortableSubtaskRow>
                );
              })}

            <div className="planning-card__subtask" style={{ marginTop: 4 }}>
              <input
                ref={subtaskInputRef}
                type="text"
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleAddSubtask();
                }}
                placeholder="Subtask hinzufügen..."
                className="planning-card__subtask-input"
                style={{
                  flex: 1,
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handleAddSubtask()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "4px 8px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 12,
                  backgroundColor: "var(--surface-sunken)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
                aria-label="Subtask hinzufügen"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableSubtaskRowProps {
  id: string;
  children: (dragHandleProps: HTMLAttributes<HTMLButtonElement>) => ReactNode;
}

function SortableSubtaskRow({ id, children }: SortableSubtaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="planning-card__subtask"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {children({
        ...attributes,
        ...(listeners ?? {}),
      } as HTMLAttributes<HTMLButtonElement>)}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, Flag, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTaskStore } from "@/stores/taskStore";
import type { Task } from "@/types";
import { toLocalDateString } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import MiniCalendar from "@/components/ui/MiniCalendar";

/** How far past the shown week upcoming deadlines are listed (in days after Sunday). */
const UPCOMING_DAYS = 14;

interface Props {
  weekStart: string;
}

/**
 * A deadline ("Abgabe") is a task with a due date but no day of its own. Work on it is
 * planned as ordinary tasks on chosen days that carry the same title and due date, so
 * they show up on Home and in the week grid like any other task.
 */
export function isDeadlineTask(task: Task) {
  return Boolean(task.dueDate) && !task.scheduledDate && !task.isBacklog && task.status !== "ARCHIVED";
}

function isWorkSessionOf(task: Task, deadline: Task) {
  return (
    task.id !== deadline.id &&
    Boolean(task.scheduledDate) &&
    task.dueDate === deadline.dueDate &&
    task.title === deadline.title
  );
}

function formatDue(date: string) {
  return format(parseISO(date), "EEE, d. MMM", { locale: de });
}

function getCountdown(dueDate: string, today: string, done: boolean) {
  if (done) return { label: "abgegeben", tone: "done" as const };
  const days = differenceInCalendarDays(parseISO(dueDate), parseISO(today));
  if (days < 0) return { label: days === -1 ? "seit gestern fällig" : `${-days} Tage überfällig`, tone: "urgent" as const };
  if (days === 0) return { label: "heute fällig", tone: "urgent" as const };
  if (days === 1) return { label: "morgen fällig", tone: "urgent" as const };
  if (days <= 3) return { label: `noch ${days} Tage`, tone: "soon" as const };
  return { label: `noch ${days} Tage`, tone: "calm" as const };
}

/** Friday of the shown week, or today if that Friday is already over. */
function defaultDueDate(weekStart: string, today: string) {
  const friday = toLocalDateString(addDays(parseISO(weekStart), 4));
  return friday < today ? today : friday;
}

export default function WeeklyDeadlines({ weekStart }: Props) {
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const today = toLocalDateString(new Date());
  const weekEnd = toLocalDateString(addDays(parseISO(weekStart), 6));
  const upcomingEnd = toLocalDateString(addDays(parseISO(weekStart), 6 + UPCOMING_DAYS));
  const isCurrentWeek = weekStart <= today && today <= weekEnd;

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState(() => defaultDueDate(weekStart, today));
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd) titleRef.current?.focus();
  }, [showAdd]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => toLocalDateString(addDays(parseISO(weekStart), index))),
    [weekStart]
  );

  const { thisWeek, upcoming } = useMemo(() => {
    const deadlines = tasks
      .filter(isDeadlineTask)
      .sort((first, second) => (first.dueDate! < second.dueDate! ? -1 : first.dueDate! > second.dueDate! ? 1 : 0));
    const open = (task: Task) => task.status !== "COMPLETED";

    return {
      thisWeek: deadlines.filter((task) => {
        const due = task.dueDate!;
        if (due >= weekStart && due <= weekEnd) return true;
        // Missed deadlines stay in view in the current week until they are done.
        return isCurrentWeek && due < weekStart && open(task);
      }),
      upcoming: deadlines.filter((task) => task.dueDate! > weekEnd && task.dueDate! <= upcomingEnd && open(task)),
    };
  }, [tasks, weekStart, weekEnd, upcomingEnd, isCurrentWeek]);

  function openAddForm() {
    if (showAdd) {
      setShowAdd(false);
      return;
    }
    setNewTitle("");
    setNewDue(defaultDueDate(weekStart, today));
    setShowAdd(true);
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !newDue) return;
    // Close right away; the card appears as soon as the server has saved it.
    setNewTitle("");
    setShowAdd(false);
    await addTask({ title, dueDate: newDue, position: 0 });
  }

  const total = thisWeek.length + upcoming.length;

  return (
    <section className="week-objectives">
      <div className="week-objectives__head">
        <div className="min-w-0">
          <h2 className="week-day__title">Abgaben</h2>
          <p className="week-day__date">
            {thisWeek.length === 0
              ? "Diese Woche nichts fällig"
              : `${thisWeek.length} diese Woche`}
          </p>
        </div>

        <button type="button" onClick={openAddForm} className="planning-toolbar__button deadline-add">
          <Plus size={14} strokeWidth={2} />
          Abgabe
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="planning-add-form week-objectives__form">
          <input
            ref={titleRef}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowAdd(false);
            }}
            placeholder="Was musst du abgeben?"
            className="planning-add-form__input"
            maxLength={120}
          />
          <MiniCalendar value={newDue} onChange={setNewDue} min={today} />
          <div className="planning-add-form__controls">
            <p className="deadline-form__date">
              bis <strong>{format(parseISO(newDue), "EEEE, d. MMMM", { locale: de })}</strong>
            </p>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newDue}
              className="planning-add-form__save disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-primary)" }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      <div className="deadline-list">
        <AnimatePresence initial={false} mode="popLayout">
          {thisWeek.map((deadline) => (
            <DeadlineCard
              key={deadline.id}
              deadline={deadline}
              sessions={tasks.filter((task) => isWorkSessionOf(task, deadline))}
              weekDays={weekDays}
              today={today}
              allTasks={tasks}
              addTask={addTask}
              updateTask={updateTask}
              deleteTask={deleteTask}
            />
          ))}
        </AnimatePresence>
      </div>

      {upcoming.length > 0 && (
        <>
          <p className="deadline-list__label">Demnächst</p>
          <div className="deadline-list deadline-list--upcoming">
            {upcoming.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                sessions={tasks.filter((task) => isWorkSessionOf(task, deadline))}
                weekDays={weekDays}
                today={today}
                allTasks={tasks}
                addTask={addTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
              />
            ))}
          </div>
        </>
      )}

      {total === 0 && !showAdd && (
        <p className="backlog-empty-copy">
          Trag ein, was du bis wann abgeben musst, und tipp die Tage an, an denen du daran arbeitest.
        </p>
      )}
    </section>
  );
}

type Store = ReturnType<typeof useTaskStore.getState>;

interface CardProps {
  deadline: Task;
  sessions: Task[];
  weekDays: string[];
  today: string;
  allTasks: Task[];
  addTask: Store["addTask"];
  updateTask: Store["updateTask"];
  deleteTask: Store["deleteTask"];
}

function DeadlineCard({
  deadline,
  sessions,
  weekDays,
  today,
  allTasks,
  addTask,
  updateTask,
  deleteTask,
}: CardProps) {
  const dueDate = deadline.dueDate!;
  const done = deadline.status === "COMPLETED";
  const countdown = getCountdown(dueDate, today, done);
  const [pendingDays, setPendingDays] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(deadline.title);

  const sessionsByDay = new Map(sessions.map((session) => [session.scheduledDate!, session]));
  const plannedCount = sessions.length;
  const doneCount = sessions.filter((session) => session.status === "COMPLETED").length;

  async function toggleDay(day: string) {
    if (pendingDays.includes(day)) return;
    const existing = sessionsByDay.get(day);
    haptic("select");

    if (existing) {
      if (existing.status === "COMPLETED") return;
      await deleteTask(existing.id);
      return;
    }

    setPendingDays((current) => [...current, day]);
    const dayCount = allTasks.filter((task) => task.scheduledDate === day).length;
    await addTask({
      title: deadline.title,
      scheduledDate: day,
      dueDate,
      channelId: deadline.channelId,
      position: dayCount,
    });
    setPendingDays((current) => current.filter((value) => value !== day));
  }

  function toggleDone() {
    haptic(done ? "select" : "success");
    void updateTask(deadline.id, { status: done ? "OPEN" : "COMPLETED" });
  }

  function saveTitle() {
    const title = editTitle.trim();
    setEditing(false);
    if (!title || title === deadline.title) {
      setEditTitle(deadline.title);
      return;
    }
    // Keep the planned work days attached by renaming them too.
    for (const session of sessions) void updateTask(session.id, { title });
    void updateTask(deadline.id, { title });
  }

  function handleDelete() {
    if (!window.confirm(`„${deadline.title}“ löschen? Offene Arbeitstage werden mit entfernt.`)) return;
    for (const session of sessions) {
      if (session.status !== "COMPLETED") void deleteTask(session.id);
    }
    void deleteTask(deadline.id);
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={`planning-card deadline-card deadline-card--${countdown.tone}${done ? " is-done" : ""}`}
    >
      <div className="deadline-card__top">
        <button
          type="button"
          onClick={toggleDone}
          className="deadline-card__check"
          aria-label={done ? "Als offen markieren" : "Als abgegeben markieren"}
          aria-pressed={done}
        >
          {done && <Check size={11} strokeWidth={3} />}
        </button>

        <div className="deadline-card__text">
          {editing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTitle();
                if (event.key === "Escape") {
                  setEditTitle(deadline.title);
                  setEditing(false);
                }
              }}
              className="planning-add-form__input deadline-card__edit"
              maxLength={120}
            />
          ) : (
            <h3
              className="planning-card__title deadline-card__title"
              onClick={() => setEditing(true)}
              title="Antippen zum Umbenennen"
            >
              {deadline.title}
            </h3>
          )}
          <p className="deadline-card__due">
            bis {formatDue(dueDate)}
            {plannedCount > 0 && (
              <>
                {" · "}
                {doneCount}/{plannedCount} {plannedCount === 1 ? "Arbeitstag" : "Arbeitstage"} erledigt
              </>
            )}
          </p>
        </div>

        <div className="deadline-card__side">
          <span className="deadline-card__countdown">{countdown.label}</span>
          <button
            type="button"
            onClick={handleDelete}
            className="deadline-card__delete"
            aria-label="Abgabe löschen"
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {!done && (
        <div className="deadline-days" role="group" aria-label="Arbeitstage einplanen">
          {weekDays.map((day) => {
            const session = sessionsByDay.get(day);
            const isDue = day === dueDate;
            const afterDue = day > dueDate;
            const isPast = day < today;
            const pending = pendingDays.includes(day);
            const sessionDone = session?.status === "COMPLETED";
            const disabled = pending || sessionDone || (!session && (afterDue || isPast));
            const label = format(parseISO(day), "EEEEEE", { locale: de });

            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => void toggleDay(day)}
                className={[
                  "deadline-day",
                  session ? "is-planned" : "",
                  sessionDone ? "is-done" : "",
                  isDue ? "is-due" : "",
                  day === today ? "is-today" : "",
                  pending ? "is-pending" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={Boolean(session)}
                aria-label={`${format(parseISO(day), "EEEE", { locale: de })}${isDue ? ", Abgabetag" : ""}${
                  session ? ", eingeplant" : ""
                }`}
              >
                <span>{label}</span>
                {sessionDone ? (
                  <Check size={10} strokeWidth={3} />
                ) : isDue ? (
                  <Flag size={10} strokeWidth={2.4} />
                ) : null}
              </button>
            );
          })}

        </div>
      )}
    </motion.article>
  );
}

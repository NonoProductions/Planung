"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronDown, Flag, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useTaskStore } from "@/stores/taskStore";
import type { Task } from "@/types";
import { toLocalDateString } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import MiniCalendar from "@/components/ui/MiniCalendar";

/** How far past the shown week upcoming deadlines are listed (in days after Sunday). */
const UPCOMING_DAYS = 14;

const EASE = [0.32, 0.72, 0, 1] as const;
const COLLAPSED_KEY = "deadline-collapsed";

/** Cards whose weekday row is folded away, remembered per device. */
function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(COLLAPSED_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCollapsed(value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): folding still works for this visit.
  }
}

/**
 * Animates its own height to fit the content, so the week grid below slides
 * instead of jumping when the form opens or cards come and go.
 */
function AutoHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    setHeight(element.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: 0.32, ease: EASE }}
      className="deadline-autoheight"
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

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
  // Read before the first paint: loading it in an effect showed cards open and then
  // folded them shut with an animation every time the page was opened.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? {} : readCollapsed()
  );

  function setCardCollapsed(id: string, value: boolean) {
    setCollapsed((current) => {
      const next = { ...current, [id]: value };
      writeCollapsed(next);
      return next;
    });
  }

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
      // Finished ones stay in place (ticked off) instead of vanishing.
      upcoming: deadlines.filter((task) => task.dueDate! > weekEnd && task.dueDate! <= upcomingEnd),
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
    const known = new Set(useTaskStore.getState().tasks.map((task) => task.id));
    await addTask({ title, dueDate: newDue, position: 0 });
    // Cards start folded, but a brand-new one opens so its work days can be picked right away.
    const created = useTaskStore
      .getState()
      .tasks.find((task) => !known.has(task.id) && isDeadlineTask(task) && task.title === title);
    if (created) setCardCollapsed(created.id, false);
  }

  const total = thisWeek.length + upcoming.length;

  function renderCard(deadline: Task) {
    return (
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
        // Folded unless opened by hand.
        collapsed={collapsed[deadline.id] ?? true}
        onCollapsedChange={(value) => setCardCollapsed(deadline.id, value)}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="week-objectives">
        <div className="week-objectives__head">
          <div className="min-w-0">
            <h2 className="week-day__title">Abgaben</h2>
            <p className="week-day__date">
              {thisWeek.length === 0 ? "Diese Woche nichts fällig" : `${thisWeek.length} diese Woche`}
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className={`planning-toolbar__button deadline-add${showAdd ? " is-open" : ""}`}
            aria-expanded={showAdd}
          >
            <Plus size={14} strokeWidth={2} className="deadline-add__icon" />
            {showAdd ? "Abbrechen" : "Abgabe"}
          </button>
        </div>

        <AutoHeight>
          {/* "wait": the empty hint only fades in once the form is gone, so the height never bumps. */}
          <AnimatePresence initial={false} mode="wait">
            {showAdd ? (
              <motion.form
                key="deadline-form"
                onSubmit={handleAdd}
                className="planning-add-form week-objectives__form"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.16 } }}
                transition={{ duration: 0.26, ease: EASE }}
                style={{ transformOrigin: "top left" }}
              >
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
              </motion.form>
            ) : total === 0 ? (
              <motion.p
                key="deadline-empty"
                className="backlog-empty-copy deadline-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2 }}
              >
                Trag ein, was du bis wann abgeben musst, und tipp die Tage an, an denen du daran arbeitest.
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div className="deadline-list">
            <AnimatePresence initial={false} mode="popLayout">
              {thisWeek.map(renderCard)}
            </AnimatePresence>
          </div>

          {upcoming.length > 0 && (
            <>
              <p className="deadline-list__label">Demnächst</p>
              <div className="deadline-list deadline-list--upcoming">
                <AnimatePresence initial={false} mode="popLayout">
                  {upcoming.map(renderCard)}
                </AnimatePresence>
              </div>
            </>
          )}

        </AutoHeight>
      </section>
    </MotionConfig>
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
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
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
  collapsed,
  onCollapsedChange,
}: CardProps) {
  const dueDate = deadline.dueDate!;
  const done = deadline.status === "COMPLETED";
  const countdown = getCountdown(dueDate, today, done);
  const [pendingDays, setPendingDays] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(deadline.title);

  const sessionsByDay = new Map(sessions.map((session) => [session.scheduledDate!, session]));

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
    // Fold the weekdays away when ticking off.
    if (!done) onCollapsedChange(true);
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

  // Two taps instead of window.confirm, which the iPhone app's web view silently answers with "no".
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  function handleDelete() {
    if (!confirmDelete) {
      haptic("select");
      setConfirmDelete(true);
      return;
    }
    haptic("success");
    for (const session of sessions) {
      if (session.status !== "COMPLETED") void deleteTask(session.id);
    }
    void deleteTask(deadline.id);
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28, ease: EASE }}
      className={`planning-card deadline-card deadline-card--${countdown.tone}${done ? " is-done" : ""}${
        collapsed ? " is-collapsed" : ""
      }`}
    >
      <div className="deadline-card__top">
        <motion.button
          type="button"
          onClick={toggleDone}
          className="deadline-card__check"
          aria-label={done ? "Als offen markieren" : "Als abgegeben markieren"}
          aria-pressed={done}
          whileTap={{ scale: 0.85 }}
        >
          <AnimatePresence initial={false}>
            {done && (
              <motion.span
                key="check"
                className="deadline-card__check-mark"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 520, damping: 22 }}
              >
                <Check size={11} strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

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
          <div className="deadline-card__meta">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={countdown.label}
                className="deadline-card__countdown"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {countdown.label}
              </motion.span>
            </AnimatePresence>
            <span className="deadline-card__due">
              bis {formatDue(dueDate)}
            </span>
          </div>
        </div>

        <div className="deadline-card__side">
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={`deadline-card__icon-button deadline-card__fold${collapsed ? " is-collapsed" : ""}`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Wochentage zeigen" : "Wochentage ausblenden"}
            title={collapsed ? "Wochentage zeigen" : "Wochentage ausblenden"}
          >
            <motion.span
              className="deadline-card__fold-icon"
              initial={false}
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <ChevronDown size={15} strokeWidth={2.2} />
            </motion.span>
          </button>
          <motion.button
            type="button"
            layout
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={`deadline-card__icon-button deadline-card__delete${confirmDelete ? " is-armed" : ""}`}
            aria-label={confirmDelete ? "Wirklich löschen" : "Abgabe löschen"}
            title={confirmDelete ? "Nochmal tippen zum Löschen" : "Abgabe löschen"}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <Trash2 size={13} strokeWidth={2} />
            <AnimatePresence initial={false}>
              {confirmDelete && (
                <motion.span
                  key="confirm"
                  className="deadline-card__delete-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  Löschen
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="days"
            className="deadline-days-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div className="deadline-days" role="group" aria-label="Arbeitstage einplanen">
              {weekDays.map((day) => {
                const session = sessionsByDay.get(day);
                const isDue = day === dueDate;
                const afterDue = day > dueDate;
                const isPast = day < today;
                const pending = pendingDays.includes(day);
                const sessionDone = session?.status === "COMPLETED";
                const disabled = done || pending || sessionDone || (!session && (afterDue || isPast));
                const label = format(parseISO(day), "EEEEEE", { locale: de });

                return (
                  <motion.button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => void toggleDay(day)}
                    whileTap={disabled ? undefined : { scale: 0.9 }}
                    className={[
                      "deadline-day",
                      session || pending ? "is-planned" : "",
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
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowRight, CalendarCheck2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toLocalDateString } from "@/lib/date";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task } from "@/types";

const QUICK_ESTIMATE_MINUTES = [15, 30, 60, 90];
const MAX_SUGGESTIONS = 5;

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function isOpenTask(task: Task) {
  return task.status !== "COMPLETED" && task.status !== "ARCHIVED";
}

export default function DailyPlanningPage() {
  const router = useRouter();

  const completePlanningRitual = useUIStore((state) => state.completePlanningRitual);
  const setAutoPlanningPromptedDate = useUIStore((state) => state.setAutoPlanningPromptedDate);
  const setSelectedDate = useUIStore((state) => state.setSelectedDate);

  const tasks = useTaskStore((state) => state.tasks);
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchBacklogTasks = useTaskStore((state) => state.fetchBacklogTasks);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchTasks();
    void fetchBacklogTasks();
    inputRef.current?.focus();
  }, [fetchBacklogTasks, fetchTasks]);

  const now = new Date();
  const today = toLocalDateString(now);
  const yesterday = toLocalDateString(subDays(now, 1));
  const todayLabel = format(now, "EEEE, d. MMMM", { locale: de });

  const todayTasks = tasks
    .filter((task) => task.scheduledDate === today && !task.isBacklog && task.status !== "ARCHIVED")
    .sort((first, second) => first.position - second.position);

  const yesterdayOpen = tasks
    .filter((task) => task.scheduledDate === yesterday && !task.isBacklog && isOpenTask(task))
    .sort((first, second) => first.position - second.position);

  const backlogSuggestions = backlogTasks
    .filter(isOpenTask)
    .sort((first, second) => {
      const firstThisWeek = first.backlogBucket === "this_week" ? 0 : 1;
      const secondThisWeek = second.backlogBucket === "this_week" ? 0 : 1;
      return firstThisWeek - secondThisWeek || first.position - second.position;
    })
    .slice(0, MAX_SUGGESTIONS);

  const plannedMinutes = todayTasks.reduce((sum, task) => sum + (task.plannedTime ?? 0), 0);

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;

    setNewTaskTitle("");
    setNewTaskMinutes(null);
    setCustomMinutes("");
    inputRef.current?.focus();

    await addTask({
      title,
      scheduledDate: today,
      plannedTime: newTaskMinutes ?? undefined,
      position: todayTasks.length,
    });
  }

  function moveToToday(task: Task) {
    void updateTask(task.id, {
      isBacklog: false,
      scheduledDate: today,
      backlogBucket: undefined,
      backlogFolder: undefined,
      position: todayTasks.length,
    });
  }

  function handleComplete() {
    completePlanningRitual(today);
    setSelectedDate(today);
    router.push("/");
  }

  function handleSkip() {
    setAutoPlanningPromptedDate(today);
    router.push("/");
  }

  return (
    <div className="workspace-page">
      <div className="planning-toolbar">
        <span className="settings-toolbar__title">Daily planning</span>
        <button type="button" onClick={handleSkip} className="planning-toolbar__button">
          Später
        </button>
      </div>

      <div className="workspace-page__scroll">
        <div className="daily-plan">
          <header>
            <h1 className="planning-column__title">Was steht heute an?</h1>
            <p className="planning-column__date">{todayLabel}</p>
          </header>

          <div className="daily-plan__composer">
            <div className="daily-plan__input-row">
              <input
                ref={inputRef}
                type="text"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddTask();
                  }
                }}
                placeholder="Aufgabe eingeben und Enter drücken"
                className="daily-plan__input"
                aria-label="Neue Aufgabe für heute"
              />
              <button
                type="button"
                onClick={() => void handleAddTask()}
                disabled={!newTaskTitle.trim()}
                className="workspace-button workspace-button--primary daily-plan__add"
              >
                <Plus size={16} strokeWidth={2.2} />
                Hinzufügen
              </button>
            </div>

            <div className="daily-plan__estimates" role="group" aria-label="Geschätzte Dauer">
              <span>Dauer</span>
              {QUICK_ESTIMATE_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setCustomMinutes("");
                    setNewTaskMinutes((current) => (current === minutes ? null : minutes));
                  }}
                  aria-pressed={!customMinutes && newTaskMinutes === minutes}
                  className="ritual-chip"
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
              <label
                className="daily-plan__custom"
                data-active={customMinutes ? "true" : undefined}
              >
                <input
                  type="number"
                  min={1}
                  step={5}
                  inputMode="numeric"
                  value={customMinutes}
                  onChange={(event) => {
                    const value = event.target.value;
                    const parsed = Number(value);
                    setCustomMinutes(value);
                    setNewTaskMinutes(value && parsed > 0 ? Math.round(parsed) : null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleAddTask();
                    }
                  }}
                  placeholder="Eigene"
                  aria-label="Eigene Dauer in Minuten"
                />
                <span>min</span>
              </label>
            </div>
          </div>

          <section className="daily-plan__section">
            <div className="daily-plan__section-head">
              <h2 className="settings-row__label">Heute geplant</h2>
              <span className="planning-card__duration">
                {todayTasks.length} {todayTasks.length === 1 ? "Aufgabe" : "Aufgaben"}
                {plannedMinutes > 0 && ` · ${formatMinutes(plannedMinutes)}`}
              </span>
            </div>

            {todayTasks.length > 0 ? (
              <div className="planning-cards__stack">
                {todayTasks.map((task) => (
                  <div key={task.id} className="group planning-card daily-plan__task">
                    <p className="planning-card__title min-w-0 flex-1">{task.title}</p>
                    {task.plannedTime ? (
                      <span className="planning-card__duration">
                        {formatMinutes(task.plannedTime)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void deleteTask(task.id)}
                      className="daily-plan__icon-button"
                      aria-label={`${task.title} entfernen`}
                      title="Entfernen"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="daily-plan__empty">
                Noch nichts geplant. Tippe oben deine erste Aufgabe ein.
              </p>
            )}
          </section>

          {yesterdayOpen.length > 0 && (
            <SuggestionList
              title="Von gestern offen"
              tasks={yesterdayOpen}
              onAdd={moveToToday}
            />
          )}

          {backlogSuggestions.length > 0 && (
            <SuggestionList
              title="Aus dem Backlog"
              tasks={backlogSuggestions}
              onAdd={moveToToday}
            />
          )}

          <button
            type="button"
            onClick={handleComplete}
            disabled={todayTasks.length === 0}
            className="workspace-button workspace-button--primary daily-plan__done"
          >
            <CalendarCheck2 size={16} strokeWidth={2} />
            Fertig, Tag starten
            <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SuggestionList({
  title,
  tasks,
  onAdd,
}: {
  title: string;
  tasks: Task[];
  onAdd: (task: Task) => void;
}) {
  return (
    <section className="daily-plan__section">
      <div className="daily-plan__section-head">
        <h2 className="settings-row__label">{title}</h2>
      </div>
      <div className="ritual-list">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onAdd(task)}
            className="ritual-row daily-plan__suggestion"
          >
            <Plus size={15} strokeWidth={2.2} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            {task.plannedTime ? (
              <span className="planning-card__duration">{formatMinutes(task.plannedTime)}</span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

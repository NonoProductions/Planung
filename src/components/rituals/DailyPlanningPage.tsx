"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowRightLeft,
  CalendarDays,
  CalendarCheck2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Plus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DonutTimer from "@/components/ui/DonutTimer";
import { toLocalDateString } from "@/lib/date";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";
import type { Task, WorkloadDay } from "@/types";

const QUICK_ESTIMATE_MINUTES = [30, 60, 90, 120];
const BACKLOG_BUCKET_LABELS: Record<string, string> = {
  this_week: "Diese Woche",
  next_weeks: "Naechste Wochen",
  someday: "Irgendwann",
};

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getWorkloadDay(date: Date): WorkloadDay {
  const days: WorkloadDay[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return days[date.getDay()] ?? "monday";
}

function getWorkloadTone(ratio: number): "success" | "warning" | "danger" {
  if (ratio > 1) return "danger";
  if (ratio >= 0.85) return "warning";
  return "success";
}

function buildShareCopy(dateLabel: string, tasks: Task[]) {
  const lines = tasks.map((task) => {
    const channel = task.channel?.name ? ` #${task.channel.name}` : "";
    const plannedTime = task.plannedTime ? ` (${formatMinutes(task.plannedTime)})` : "";
    return `- ${task.title}${channel}${plannedTime}`;
  });

  return [`Plan fuer ${dateLabel}`, "", ...lines].join("\n").trim();
}

function isOpenTask(task: Task) {
  return task.status !== "COMPLETED" && task.status !== "ARCHIVED";
}

function updateSeededList(
  currentSeed: string,
  nextSeed: string,
  currentItems: string[],
  fallbackItems: string[],
  updater: (items: string[]) => string[]
) {
  const baseItems = currentSeed === nextSeed ? currentItems : fallbackItems;
  return {
    seed: nextSeed,
    ids: updater(baseItems),
  };
}

function updateSeededRecord(
  currentSeed: string,
  nextSeed: string,
  currentValues: Record<string, string>,
  fallbackValues: Record<string, string>,
  updater: (values: Record<string, string>) => Record<string, string>
) {
  const baseValues = currentSeed === nextSeed ? currentValues : fallbackValues;
  return {
    seed: nextSeed,
    values: updater(baseValues),
  };
}

export default function DailyPlanningPage() {
  const router = useRouter();

  const selectedDate = useUIStore((state) => state.selectedDate);
  const setSelectedDate = useUIStore((state) => state.setSelectedDate);
  const completePlanningRitual = useUIStore((state) => state.completePlanningRitual);
  const setAutoPlanningPromptedDate = useUIStore((state) => state.setAutoPlanningPromptedDate);
  const planningRitualCompletedDates = useUIStore(
    (state) => state.planningRitualCompletedDates
  );

  const tasks = useTaskStore((state) => state.tasks);
  const backlogTasks = useTaskStore((state) => state.backlogTasks);
  const channels = useTaskStore((state) => state.channels);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const fetchBacklogTasks = useTaskStore((state) => state.fetchBacklogTasks);
  const fetchChannels = useTaskStore((state) => state.fetchChannels);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);

  const settings = useSettingsStore((state) => state.settings);

  const [carryoverSelectionState, setCarryoverSelectionState] = useState<{
    seed: string;
    ids: string[];
  }>({ seed: "", ids: [] });
  const [backlogQuery, setBacklogQuery] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskChannelId, setNewTaskChannelId] = useState("");
  const [newTaskPlannedTime, setNewTaskPlannedTime] = useState("");
  const [estimateDraftState, setEstimateDraftState] = useState<{
    seed: string;
    values: Record<string, string>;
  }>({ seed: "", values: {} });
  const [notice, setNotice] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    void fetchTasks();
    void fetchBacklogTasks();
    void fetchChannels();
  }, [fetchBacklogTasks, fetchChannels, fetchTasks]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const selectedDay = parseISO(selectedDate);
  const previousDate = toLocalDateString(subDays(selectedDay, 1));
  const nextDate = toLocalDateString(addDays(selectedDay, 1));
  const activeDateLabel = format(selectedDay, "EEEE, d. MMMM", { locale: de });

  const dayTasks = tasks
    .filter(
      (task) =>
        task.scheduledDate === selectedDate &&
        !task.isBacklog &&
        task.status !== "ARCHIVED"
    )
    .sort((first, second) => first.position - second.position);

  const openDayTasks = dayTasks.filter(isOpenTask);
  const completedDayTasks = dayTasks.filter((task) => task.status === "COMPLETED");

  const yesterdayCarryover = tasks
    .filter(
      (task) =>
        task.scheduledDate === previousDate &&
        !task.isBacklog &&
        isOpenTask(task)
    )
    .sort((first, second) => first.position - second.position);

  const carryoverSeed = yesterdayCarryover.map((task) => task.id).join("|");
  const defaultCarryoverSelection = yesterdayCarryover.map((task) => task.id);
  const activeCarryoverSelection =
    carryoverSelectionState.seed === carryoverSeed
      ? carryoverSelectionState.ids
      : defaultCarryoverSelection;

  const estimateSeed = openDayTasks
    .map((task) => `${task.id}:${task.plannedTime ?? ""}`)
    .join("|");
  const defaultEstimateDrafts = Object.fromEntries(
    openDayTasks.map((task) => [task.id, String(task.plannedTime ?? 30)])
  );
  const activeEstimateDrafts =
    estimateDraftState.seed === estimateSeed
      ? estimateDraftState.values
      : defaultEstimateDrafts;

  const query = backlogQuery.trim().toLowerCase();
  const filteredBacklogTasks = backlogTasks
    .filter((task) => isOpenTask(task))
    .filter((task) => {
      if (!query) return true;
      const bucket = task.backlogBucket
        ? BACKLOG_BUCKET_LABELS[task.backlogBucket] ?? task.backlogBucket
        : "";
      const haystack = [
        task.title,
        task.channel?.name ?? "",
        task.backlogFolder ?? "",
        bucket,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    })
    .sort((first, second) => {
      const firstBucket = first.backlogFolder ?? first.backlogBucket ?? "zzz";
      const secondBucket = second.backlogFolder ?? second.backlogBucket ?? "zzz";
      if (firstBucket !== secondBucket) {
        return firstBucket.localeCompare(secondBucket);
      }
      return first.position - second.position;
    });

  const plannedMinutes = openDayTasks.reduce(
    (sum, task) => sum + (task.plannedTime ?? 0),
    0
  );
  const unestimatedCount = openDayTasks.filter((task) => !task.plannedTime).length;
  const dailyLimit = settings.workload[getWorkloadDay(selectedDay)];
  const workloadRatio = dailyLimit > 0 ? plannedMinutes / dailyLimit : 0;
  const workloadTone = getWorkloadTone(workloadRatio);
  const remainingMinutes = dailyLimit - plannedMinutes;
  const planningDone = planningRitualCompletedDates.includes(selectedDate);
  const shareCopy = buildShareCopy(activeDateLabel, openDayTasks);

  async function handleCarryoverApply() {
    if (activeCarryoverSelection.length === 0) return;

    await Promise.all(
      activeCarryoverSelection.map((taskId, index) =>
        updateTask(taskId, {
          scheduledDate: selectedDate,
          position: dayTasks.length + index,
        })
      )
    );

    setNotice(
      `${activeCarryoverSelection.length} ${
        activeCarryoverSelection.length === 1 ? "Aufgabe" : "Aufgaben"
      } auf ${format(selectedDay, "d. MMM", { locale: de })} uebernommen.`
    );
  }

  async function handleImportBacklog(task: Task) {
    await updateTask(task.id, {
      isBacklog: false,
      scheduledDate: selectedDate,
      backlogBucket: undefined,
      backlogFolder: undefined,
      position: dayTasks.length,
    });

    setNotice(`"${task.title}" wurde in den Tagesplan gezogen.`);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;

    await addTask({
      title,
      scheduledDate: selectedDate,
      channelId: newTaskChannelId || undefined,
      plannedTime: newTaskPlannedTime ? Number(newTaskPlannedTime) : undefined,
      position: dayTasks.length,
    });

    setNewTaskTitle("");
    setNewTaskChannelId("");
    setNewTaskPlannedTime("");
    setNotice(`"${title}" wurde fuer heute angelegt.`);
  }

  async function commitEstimate(taskId: string) {
    const rawValue = activeEstimateDrafts[taskId]?.trim() ?? "";

    if (!rawValue) {
      await updateTask(taskId, { plannedTime: undefined });
      return;
    }

    const parsedMinutes = Number(rawValue);
    if (!Number.isFinite(parsedMinutes)) return;

    const normalizedMinutes = Math.max(5, Math.round(parsedMinutes / 5) * 5);

    setEstimateDraftState((current) =>
      updateSeededRecord(
        current.seed,
        estimateSeed,
        current.values,
        defaultEstimateDrafts,
        (values) => ({
          ...values,
          [taskId]: String(normalizedMinutes),
        })
      )
    );

    await updateTask(taskId, { plannedTime: normalizedMinutes });
  }

  async function handleCopySharePlan() {
    try {
      await navigator.clipboard.writeText(shareCopy);
      setShareCopied(true);
      setNotice("Der Tagesplan wurde in die Zwischenablage kopiert.");
      window.setTimeout(() => setShareCopied(false), 2200);
    } catch {
      setNotice("Kopieren hat im Browser nicht funktioniert.");
    }
  }

  function handleCompletePlanning() {
    completePlanningRitual(selectedDate);
    setNotice("Das Planning Ritual ist fuer diesen Tag abgeschlossen.");
    router.push("/");
  }

  function handleSkipPlanning() {
    setAutoPlanningPromptedDate(toLocalDateString(new Date()));
    router.push("/");
  }

  function toggleCarryover(taskId: string) {
    setCarryoverSelectionState((current) =>
      updateSeededList(
        current.seed,
        carryoverSeed,
        current.ids,
        defaultCarryoverSelection,
        (items) =>
          items.includes(taskId)
            ? items.filter((id) => id !== taskId)
            : [...items, taskId]
      )
    );
  }

  function handleEstimateKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    taskId: string
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitEstimate(taskId);
    }
  }

  function toggleAllCarryover() {
    setCarryoverSelectionState((current) =>
      updateSeededList(
        current.seed,
        carryoverSeed,
        current.ids,
        defaultCarryoverSelection,
        (items) =>
          items.length === yesterdayCarryover.length
            ? []
            : yesterdayCarryover.map((task) => task.id)
      )
    );
  }

  return (
    <div className="workspace-page planning-workspace-page">
      <div className="workspace-page__header">
        <div className="workspace-page__intro">
          <p className="workspace-page__eyebrow">Daily Planning</p>
          <h1 className="workspace-page__title workspace-page__title--wide">
            Planung fuer {activeDateLabel}
          </h1>
          <p className="workspace-page__copy">
            Die Morgenplanung ist jetzt eine eigene Seite. Du kannst Uebernahmen
            aus dem Vortag sammeln, Backlog-Aufgaben einziehen, Schaetzungen in
            5-Minuten-Schritten setzen und erst dann zur Tagesansicht zurueckkehren.
          </p>

          <div className="workspace-page__meta">
            <StatusPill
              label={
                planningDone ? "Bereits abgeschlossen" : "Noch nicht abgeschlossen"
              }
              tone={planningDone ? "success" : "accent"}
            />
            <StatusPill label={`${openDayTasks.length} offene Tasks`} tone="neutral" />
            <StatusPill
              label={`${formatMinutes(plannedMinutes)} geplant`}
              tone={workloadTone}
            />
          </div>
        </div>

        <div className="workspace-page__actions planning-toolbar__group planning-toolbar__group--nav">
          <button
            type="button"
            onClick={() => setSelectedDate(previousDate)}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Vorheriger Tag"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(toLocalDateString(new Date()))}
            className="planning-toolbar__button"
          >
            <CalendarDays size={15} strokeWidth={1.9} />
            Today
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(nextDate)}
            className="planning-toolbar__button planning-toolbar__button--icon"
            aria-label="Naechster Tag"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={handleSkipPlanning}
            className="planning-toolbar__button"
          >
            Ueberspringen
          </button>
        </div>
      </div>

      <div className="workspace-page__scroll">
        <div className="workspace-page__content workspace-page__content--wide">
          <div className="workspace-page__stack">
            {notice && (
              <div className="workspace-note planning-note px-4 py-3 text-[13px] leading-6">
                {notice}
              </div>
            )}

            <div className="planning-stat-grid">
              <StatCard
                icon={<ArrowRightLeft size={17} strokeWidth={2} />}
                label="Carryover"
                value={String(yesterdayCarryover.length)}
                detail={
                  yesterdayCarryover.length > 0
                    ? "Offene Punkte von gestern koennen gezielt uebernommen werden."
                    : "Keine offenen Altlasten fuer den Start in den Tag."
                }
              />
              <StatCard
                icon={<Clock3 size={17} strokeWidth={2} />}
                label="Geplante Zeit"
                value={formatMinutes(plannedMinutes)}
                detail={
                  dailyLimit > 0
                    ? `${formatMinutes(dailyLimit)} Tageslimit laut Settings.`
                    : "Noch kein Tageslimit hinterlegt."
                }
              />
              <StatCard
                icon={<CheckCheck size={17} strokeWidth={2} />}
                label="Bereits erledigt"
                value={String(completedDayTasks.length)}
                detail={
                  completedDayTasks.length > 0
                    ? "Abgeschlossene Tasks bleiben sichtbar und geben Kontext."
                    : "Der Tag ist noch komplett offen."
                }
              />
            </div>

            <div className="workspace-page__split--wide planning-ritual-layout">
              <div className="planning-ritual-column">
                <SurfaceCard
                  eyebrow="Schritt 1"
                  title="Unerledigte Aufgaben von gestern pruefen"
                  action={
                    yesterdayCarryover.length > 0 ? (
                      <button
                        type="button"
                        onClick={toggleAllCarryover}
                        className="workspace-button"
                      >
                        {activeCarryoverSelection.length === yesterdayCarryover.length
                          ? "Alle abwaehlen"
                          : "Alle markieren"}
                      </button>
                    ) : undefined
                  }
                >
                  {yesterdayCarryover.length > 0 ? (
                    <>
                      <div className="planning-flow-list">
                        {yesterdayCarryover.map((task) => {
                          const selected = activeCarryoverSelection.includes(task.id);

                          return (
                            <label
                              key={task.id}
                              data-selected={selected ? "true" : "false"}
                              className="planning-flow-item planning-flow-item--selectable"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleCarryover(task.id)}
                                className="mt-1 h-4 w-4 accent-[var(--accent-primary)]"
                              />
                              <TaskCopy
                                title={task.title}
                                meta={[
                                  task.channel?.name ? `#${task.channel.name}` : null,
                                  task.plannedTime
                                    ? `${formatMinutes(task.plannedTime)} geplant`
                                    : "ohne Schaetzung",
                                ]}
                              />
                            </label>
                          );
                        })}
                      </div>

                      <div className="planning-action-row mt-6">
                        <button
                          type="button"
                          onClick={() => void handleCarryoverApply()}
                          className="workspace-button workspace-button--primary"
                          disabled={activeCarryoverSelection.length === 0}
                        >
                          Auswahl uebernehmen
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(previousDate)}
                          className="workspace-button"
                        >
                          Gestern ansehen
                        </button>
                      </div>
                    </>
                  ) : (
                    <EmptyState text="Gestern sind keine offenen Aufgaben uebrig geblieben. Du startest heute mit einem sauberen Blatt." />
                  )}
                </SurfaceCard>

                <SurfaceCard
                  eyebrow="Schritt 2"
                  title="Backlog importieren oder neue Aufgaben anlegen"
                >
                  <div className="planning-quickadd-grid">
                    <div className="planning-quickadd-panel">
                      <div className="planning-copy-block">
                        <p
                          className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Quick Add
                        </p>
                        <p
                          className="mt-2 text-[13px] leading-6"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Direkt in den heutigen Plan schreiben, ohne den Kontext
                          zu verlassen.
                        </p>
                      </div>

                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(event) => setNewTaskTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAddTask();
                          }
                        }}
                        placeholder="Neue Aufgabe fuer heute"
                        className="workspace-input"
                      />

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <select
                          value={newTaskChannelId}
                          onChange={(event) => setNewTaskChannelId(event.target.value)}
                          className="workspace-input"
                        >
                          <option value="">Kein Channel</option>
                          {channels.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                              #{channel.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={newTaskPlannedTime}
                          onChange={(event) => setNewTaskPlannedTime(event.target.value)}
                          placeholder="Min"
                          className="workspace-input"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleAddTask()}
                        className="workspace-button workspace-button--primary"
                      >
                        <Plus size={15} strokeWidth={2} />
                        Aufgabe in den Plan legen
                      </button>
                    </div>

                    <div className="planning-backlog-panel">
                      <div className="planning-search-row">
                        <input
                          type="text"
                          value={backlogQuery}
                          onChange={(event) => setBacklogQuery(event.target.value)}
                          placeholder="Backlog durchsuchen"
                          className="workspace-input min-w-0 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => router.push("/backlog")}
                          className="workspace-button"
                        >
                          Backlog oeffnen
                        </button>
                      </div>

                      {filteredBacklogTasks.length > 0 ? (
                        <div className="planning-flow-list">
                          {filteredBacklogTasks.slice(0, 6).map((task) => (
                            <div
                              key={task.id}
                              className="planning-flow-item planning-flow-item--backlog"
                            >
                              <div className="pt-1">
                                <StatusPill
                                  label={
                                    task.backlogFolder ??
                                    BACKLOG_BUCKET_LABELS[task.backlogBucket ?? "someday"] ??
                                    "Backlog"
                                  }
                                  tone="neutral"
                                />
                              </div>
                              <TaskCopy
                                title={task.title}
                                meta={[
                                  task.channel?.name ? `#${task.channel.name}` : null,
                                  task.plannedTime
                                    ? `${formatMinutes(task.plannedTime)} geplant`
                                    : "noch ohne Schaetzung",
                                ]}
                              />
                              <button
                                type="button"
                                onClick={() => void handleImportBacklog(task)}
                                className="workspace-button ml-auto shrink-0"
                              >
                                Einziehen
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState text="Kein passender Backlog-Eintrag gefunden. Du kannst direkt oben eine neue Aufgabe erfassen." />
                      )}
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard
                  eyebrow="Schritt 3"
                  title="Zeit in 5-Minuten-Schritten schaetzen"
                  action={
                    unestimatedCount > 0 ? (
                      <StatusPill
                        label={`${unestimatedCount} ohne Schaetzung`}
                        tone="warning"
                      />
                    ) : (
                      <StatusPill label="Alles geschaetzt" tone="success" />
                    )
                  }
                >
                  {openDayTasks.length > 0 ? (
                    <div className="planning-flow-list">
                      {openDayTasks.map((task) => {
                        const draftValue =
                          activeEstimateDrafts[task.id] ?? String(task.plannedTime ?? 30);
                        const parsedDraft = Number(draftValue);
                        const donutMinutes =
                          Number.isFinite(parsedDraft) && parsedDraft > 0
                            ? parsedDraft
                            : Math.max(task.plannedTime ?? 30, 5);

                        return (
                          <div
                            key={task.id}
                            className="planning-flow-item planning-flow-item--estimate"
                          >
                            <div className="planning-estimate-row">
                              <div className="flex items-start gap-4 md:min-w-0 md:flex-1">
                                <DonutTimer
                                  planned={donutMinutes}
                                  actual={donutMinutes}
                                  size={44}
                                />
                                <TaskCopy
                                  title={task.title}
                                  meta={[
                                    task.channel?.name ? `#${task.channel.name}` : null,
                                    task.status === "IN_PROGRESS" ? "in Bearbeitung" : null,
                                  ]}
                                />
                              </div>

                              <div className="planning-estimate-controls">
                                <div className="planning-inline-input">
                                  <input
                                    type="number"
                                    min={5}
                                    step={5}
                                    value={draftValue}
                                    onChange={(event) =>
                                      setEstimateDraftState((current) =>
                                        updateSeededRecord(
                                          current.seed,
                                          estimateSeed,
                                          current.values,
                                          defaultEstimateDrafts,
                                          (values) => ({
                                            ...values,
                                            [task.id]: event.target.value,
                                          })
                                        )
                                      )
                                    }
                                    onBlur={() => void commitEstimate(task.id)}
                                    onKeyDown={(event) => handleEstimateKeyDown(event, task.id)}
                                    className="workspace-input"
                                  />
                                  <span
                                    className="text-[12px] font-medium"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    Minuten
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {QUICK_ESTIMATE_MINUTES.map((minutes) => (
                                    <button
                                      key={`${task.id}-${minutes}`}
                                      type="button"
                                      onClick={() => {
                                        setEstimateDraftState((current) =>
                                          updateSeededRecord(
                                            current.seed,
                                            estimateSeed,
                                            current.values,
                                            defaultEstimateDrafts,
                                            (values) => ({
                                              ...values,
                                              [task.id]: String(minutes),
                                            })
                                          )
                                        );
                                        void updateTask(task.id, {
                                          plannedTime: minutes,
                                        });
                                      }}
                                      className="workspace-button h-auto min-h-0 px-3 py-2 text-[12px]"
                                    >
                                      {formatMinutes(minutes)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState text="Noch keine offenen Tasks fuer diesen Tag vorhanden. Zieh zuerst Aufgaben aus dem Backlog rein oder lege neue an." />
                  )}
                </SurfaceCard>
              </div>

              <div className="planning-ritual-column">
                <SurfaceCard
                  eyebrow="Schritt 4"
                  title="Workload gegen dein Tageslimit halten"
                >
                  <div className="planning-workload-panel">
                    <div className="planning-workload-head">
                      <div className="planning-workload-metric">
                        <p
                          className="planning-workload-label"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Geplant
                        </p>
                        <p
                          className="planning-workload-value"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatMinutes(plannedMinutes)}
                        </p>
                      </div>

                      <div className="planning-workload-divider" aria-hidden="true" />

                      <div className="planning-workload-metric planning-workload-metric--secondary">
                        <p
                          className="planning-workload-label"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Limit
                        </p>
                        <p
                          className="planning-workload-value planning-workload-value--secondary"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {formatMinutes(dailyLimit)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="planning-workload-bar h-3 overflow-hidden rounded-full"
                      style={{ backgroundColor: "rgba(230, 223, 215, 0.92)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(workloadRatio, 1) * 100}%`,
                          background:
                            workloadTone === "danger"
                              ? "linear-gradient(90deg, #e06f6f, #e88d8d)"
                              : workloadTone === "warning"
                                ? "linear-gradient(90deg, #f4ad46, #f2c06d)"
                                : "linear-gradient(90deg, #57b679, #7bc892)",
                        }}
                      />
                    </div>

                    <div className="planning-workload-badges">
                      <StatusPill
                        label={
                          remainingMinutes >= 0
                            ? `${formatMinutes(remainingMinutes)} frei`
                            : `${formatMinutes(Math.abs(remainingMinutes))} ueber Limit`
                        }
                        tone={workloadTone}
                      />
                      <StatusPill
                        label={`${openDayTasks.length} Tasks im Fokus`}
                        tone="neutral"
                      />
                      <StatusPill
                        label={`${unestimatedCount} ohne Zeit`}
                        tone={unestimatedCount > 0 ? "warning" : "success"}
                      />
                    </div>

                    <div
                      className={`workspace-note planning-workload-note px-4 py-3 text-[13px] leading-6 ${
                        workloadTone === "danger"
                          ? "workspace-surface--danger"
                          : workloadTone === "warning"
                            ? "workspace-surface--warning"
                            : ""
                      }`}
                    >
                      {workloadTone === "danger"
                        ? "Du bist ueber deinem Tageslimit. Ein Task sollte raus, kleiner geschaetzt oder in einen anderen Tag geschoben werden."
                        : workloadTone === "warning"
                          ? "Die Planung ist dicht. Noch eine groessere Aufgabe wuerde den Tag vermutlich ueberladen."
                          : "Die Planung liegt innerhalb des Limits und laesst noch Luft fuer Kontextwechsel und Ueberraschungen."}
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard
                  eyebrow="Schritt 5"
                  title="Plan teilen und Ritual abschliessen"
                  accent
                >
                  <p
                    className="text-[13px] leading-6"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Slack- oder Teams-Integration ist noch nicht direkt verdrahtet.
                    Der formatierte Tagesplan ist aber bereit zum Kopieren und Teilen.
                  </p>

                  <textarea
                    readOnly
                    value={shareCopy}
                    className="workspace-input workspace-input--textarea planning-share-copy mt-5 min-h-44 w-full resize-none text-[13px] leading-7"
                  />

                  <div className="planning-share-actions mt-6">
                    <button
                      type="button"
                      onClick={() => void handleCopySharePlan()}
                      className="workspace-button"
                    >
                      {shareCopied ? (
                        <ClipboardCheck size={15} strokeWidth={2} />
                      ) : (
                        <Copy size={15} strokeWidth={2} />
                      )}
                      {shareCopied ? "Kopiert" : "Plan kopieren"}
                    </button>

                    <button
                      type="button"
                      onClick={handleCompletePlanning}
                      className="workspace-button workspace-button--primary"
                    >
                      <CalendarCheck2 size={15} strokeWidth={2} />
                      Ritual abschliessen
                    </button>
                  </div>
                </SurfaceCard>

                <SurfaceCard
                  eyebrow="Heute im Blick"
                  title="Was der Plan gerade priorisiert"
                >
                  {openDayTasks.length > 0 ? (
                    <div className="planning-flow-list">
                      {openDayTasks.slice(0, 4).map((task) => (
                        <div
                          key={task.id}
                          className="planning-flow-item planning-flow-item--highlight"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                            style={{
                              backgroundColor: "rgba(141, 124, 246, 0.14)",
                              color: "var(--accent-primary)",
                            }}
                          >
                            <Sparkles size={14} strokeWidth={2} />
                          </span>
                          <TaskCopy
                            title={task.title}
                            meta={[
                              task.channel?.name ? `#${task.channel.name}` : null,
                              task.plannedTime
                                ? `${formatMinutes(task.plannedTime)} geplant`
                                : "noch ohne Zeitfenster",
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="Sobald du Aufgaben fuer heute einplanst, tauchen sie hier als kompakte Fokusliste auf." />
                  )}
                </SurfaceCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurfaceCard({
  title,
  eyebrow,
  children,
  action,
  accent = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`workspace-surface workspace-section planning-section ${accent ? "workspace-surface--accent planning-section--accent" : ""}`}
    >
      <div className="workspace-section__header">
        <div className="workspace-section__intro">
          {eyebrow && <p className="workspace-section__eyebrow">{eyebrow}</p>}
          <h2 className="workspace-section__title">{title}</h2>
        </div>
        {action}
      </div>
      <div className="workspace-section__body">{children}</div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="workspace-surface workspace-section planning-stat-card flex min-h-[156px] flex-col justify-between">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
            style={{
              backgroundColor: "rgba(244, 239, 232, 0.92)",
              color: "var(--accent-primary)",
            }}
          >
            {icon}
          </span>

          <div className="space-y-2">
            <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {label}
            </p>
            <p
              className="text-[30px] font-semibold leading-[1.02] tracking-[-0.06em]"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="workspace-note text-[14px] leading-7">{text}</div>;
}

function TaskCopy({
  title,
  meta,
}: {
  title: string;
  meta: Array<string | null>;
}) {
  const detail = meta.filter(Boolean).join(" / ");

  return (
    <div className="planning-task-copy min-w-0 flex-1">
      <p
        className="text-[14px] font-medium leading-6"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
        {detail || "Ohne weitere Details"}
      </p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "neutral" | "success" | "warning" | "danger";
}) {
  const toneClassName =
    tone === "accent"
      ? "workspace-badge--accent"
      : tone === "success"
        ? "workspace-badge--success"
        : tone === "warning"
          ? "workspace-badge--warning"
          : tone === "danger"
            ? "workspace-badge--danger"
            : "";

  return <span className={`workspace-badge ${toneClassName}`}>{label}</span>;
}

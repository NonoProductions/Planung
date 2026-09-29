"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  CalendarDays,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Plus,
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
    <div className="workspace-page">
      <div className="planning-toolbar">
        <div className="planning-toolbar__group planning-toolbar__group--nav">
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
          <span className="settings-toolbar__title ml-2 hidden sm:inline">
            Planung fuer {activeDateLabel}
          </span>
        </div>

        <div className="planning-toolbar__group">
          <button type="button" onClick={handleSkipPlanning} className="planning-toolbar__button">
            Ueberspringen
          </button>
          <button
            type="button"
            onClick={handleCompletePlanning}
            className="workspace-button workspace-button--primary ritual-toolbar-primary"
          >
            <CalendarCheck2 size={15} strokeWidth={2} />
            Abschliessen
          </button>
        </div>
      </div>

      <div className="workspace-page__scroll">
        <div className="analytics-page">
          {notice && <p className="analytics-notice">{notice}</p>}

          <div className="analytics-stats">
            <Stat
              label="Status"
              value={planningDone ? "Geplant" : "Offen"}
              detail={planningDone ? "Ritual abgeschlossen" : "Ritual noch nicht abgeschlossen"}
            />
            <Stat
              label="Carryover"
              value={String(yesterdayCarryover.length)}
              detail="Offene Aufgaben von gestern"
            />
            <Stat
              label="Geplante Zeit"
              value={formatMinutes(plannedMinutes)}
              detail={
                dailyLimit > 0
                  ? `von ${formatMinutes(dailyLimit)} Tageslimit`
                  : "Noch kein Tageslimit hinterlegt"
              }
              tone={workloadTone}
            />
            <Stat
              label="Erledigt"
              value={`${completedDayTasks.length}/${completedDayTasks.length + openDayTasks.length}`}
              detail="Aufgaben an diesem Tag"
            />
          </div>

          <div className="analytics-columns">
            <RitualSection
              title="Gestern"
              subtitle="Offene Aufgaben uebernehmen"
              action={
                yesterdayCarryover.length > 0 ? (
                  <button type="button" onClick={toggleAllCarryover} className="planning-toolbar__button">
                    {activeCarryoverSelection.length === yesterdayCarryover.length
                      ? "Keine"
                      : "Alle"}
                  </button>
                ) : undefined
              }
            >
              {yesterdayCarryover.length > 0 ? (
                <>
                  <div className="ritual-list">
                    {yesterdayCarryover.map((task) => {
                      const selected = activeCarryoverSelection.includes(task.id);

                      return (
                        <label key={task.id} className="ritual-row ritual-row--selectable">
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

                  <div className="ritual-actions">
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
                <EmptyState text="Gestern ist nichts offen geblieben. Du startest mit einem sauberen Blatt." />
              )}
            </RitualSection>

            <RitualSection title="Hinzufuegen" subtitle="Neu anlegen oder aus dem Backlog">
              <div className="ritual-form">
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
                  className="workspace-input settings-input"
                />
                <div className="flex gap-2">
                  <select
                    value={newTaskChannelId}
                    onChange={(event) => setNewTaskChannelId(event.target.value)}
                    className="workspace-input settings-input min-w-0 flex-1"
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
                    className="workspace-input analytics-minutes"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddTask()}
                  className="workspace-button workspace-button--primary self-start"
                >
                  <Plus size={15} strokeWidth={2} />
                  Zum Plan hinzufuegen
                </button>
              </div>

              <div className="ritual-subhead">
                <input
                  type="text"
                  value={backlogQuery}
                  onChange={(event) => setBacklogQuery(event.target.value)}
                  placeholder="Backlog durchsuchen"
                  className="workspace-input settings-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => router.push("/backlog")}
                  className="planning-toolbar__button"
                >
                  Backlog
                </button>
              </div>

              {filteredBacklogTasks.length > 0 ? (
                <div className="ritual-list">
                  {filteredBacklogTasks.slice(0, 6).map((task) => (
                    <div key={task.id} className="ritual-row">
                      <TaskCopy
                        title={task.title}
                        meta={[
                          task.backlogFolder ??
                            BACKLOG_BUCKET_LABELS[task.backlogBucket ?? "someday"] ??
                            "Backlog",
                          task.channel?.name ? `#${task.channel.name}` : null,
                          task.plannedTime ? formatMinutes(task.plannedTime) : null,
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => void handleImportBacklog(task)}
                        className="planning-toolbar__button shrink-0"
                      >
                        <Plus size={13} strokeWidth={2.2} />
                        Einziehen
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Kein passender Backlog-Eintrag gefunden." />
              )}
            </RitualSection>

            <RitualSection
              title="Schaetzen"
              subtitle={
                unestimatedCount > 0 ? (
                  <span style={{ color: "var(--accent-warning)" }}>
                    {unestimatedCount} ohne Schaetzung
                  </span>
                ) : (
                  "In 5-Minuten-Schritten"
                )
              }
            >
              {openDayTasks.length > 0 ? (
                <div className="ritual-list">
                  {openDayTasks.map((task) => {
                    const draftValue =
                      activeEstimateDrafts[task.id] ?? String(task.plannedTime ?? 30);
                    const parsedDraft = Number(draftValue);
                    const donutMinutes =
                      Number.isFinite(parsedDraft) && parsedDraft > 0
                        ? parsedDraft
                        : Math.max(task.plannedTime ?? 30, 5);

                    return (
                      <div key={task.id} className="ritual-row ritual-row--stacked">
                        <div className="flex items-start gap-3">
                          <DonutTimer planned={donutMinutes} actual={donutMinutes} size={32} />
                          <TaskCopy
                            title={task.title}
                            meta={[
                              task.channel?.name ? `#${task.channel.name}` : null,
                              task.status === "IN_PROGRESS" ? "in Bearbeitung" : null,
                            ]}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
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
                            className="workspace-input analytics-minutes ritual-estimate-input"
                            aria-label="Minuten"
                          />
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
                              className="ritual-chip"
                            >
                              {formatMinutes(minutes)}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState text="Noch keine offenen Tasks fuer diesen Tag. Zieh Aufgaben aus dem Backlog rein oder lege neue an." />
              )}
            </RitualSection>

            <RitualSection
              title="Workload"
              subtitle={
                remainingMinutes >= 0
                  ? `${formatMinutes(remainingMinutes)} frei`
                  : `${formatMinutes(Math.abs(remainingMinutes))} ueber Limit`
              }
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="analytics-stat__label">Geplant</p>
                  <p className="analytics-timer">{formatMinutes(plannedMinutes)}</p>
                </div>
                <div className="text-right">
                  <p className="analytics-stat__label">Limit</p>
                  <p className="analytics-timer" style={{ color: "var(--text-secondary)" }}>
                    {formatMinutes(dailyLimit)}
                  </p>
                </div>
              </div>

              <div className="planning-progress ritual-progress">
                <div
                  className="planning-progress__fill"
                  style={{
                    width: `${Math.min(workloadRatio, 1) * 100}%`,
                    background:
                      workloadTone === "danger"
                        ? "var(--accent-danger)"
                        : workloadTone === "warning"
                          ? "var(--accent-warning)"
                          : "var(--accent-success)",
                  }}
                />
              </div>

              <p className="settings-row__description mt-3">
                {workloadTone === "danger"
                  ? "Du bist ueber deinem Tageslimit. Ein Task sollte raus, kleiner geschaetzt oder verschoben werden."
                  : workloadTone === "warning"
                    ? "Die Planung ist dicht. Noch eine groessere Aufgabe wuerde den Tag vermutlich ueberladen."
                    : "Die Planung liegt im Limit und laesst Luft fuer Ueberraschungen."}
              </p>
            </RitualSection>

            <RitualSection title="Teilen" subtitle="Plan kopieren und abschliessen">
              <textarea
                readOnly
                value={shareCopy}
                className="workspace-input workspace-input--textarea ritual-textarea"
              />
              <div className="ritual-actions">
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
            </RitualSection>

            <RitualSection title="Heute im Blick" subtitle="Was der Plan priorisiert">
              {openDayTasks.length > 0 ? (
                <div className="ritual-list">
                  {openDayTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="ritual-row">
                      <TaskCopy
                        title={task.title}
                        meta={[task.channel?.name ? `#${task.channel.name}` : null]}
                      />
                      <span className="planning-card__duration">
                        {task.plannedTime ? formatMinutes(task.plannedTime) : "--"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Sobald du Aufgaben einplanst, tauchen sie hier auf." />
              )}
            </RitualSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function RitualSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="analytics-section">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="planning-column__title">{title}</h2>
          <p className="planning-column__date">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="analytics-section__body">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "accent" | "neutral" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "var(--accent-danger)"
      : tone === "warning"
        ? "var(--accent-warning)"
        : undefined;

  return (
    <div className="analytics-stat">
      <p className="analytics-stat__label">{label}</p>
      <p className="analytics-stat__value" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="analytics-stat__detail">{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="settings-row__description">{text}</p>;
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
      <p className="settings-row__label">{title}</p>
      {detail && <p className="settings-row__description">{detail}</p>}
    </div>
  );
}

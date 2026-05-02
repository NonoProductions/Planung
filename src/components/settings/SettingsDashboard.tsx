"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Clock3,
  Download,
  Globe,
  LoaderCircle,
  Mail,
  Monitor,
  Moon,
  Palette,
  Repeat,
  Sun,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { buildPlannerExportCsv } from "@/lib/planner-export";
import { useObjectiveStore } from "@/stores/objectiveStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTaskStore } from "@/stores/taskStore";
import FocusPomoSync from "@/components/settings/FocusPomoSync";
import type {
  CelebrationType,
  PlannerExportData,
  ThemeMode,
  WorkloadDay,
} from "@/types";

const dayMeta: Array<{ key: WorkloadDay; label: string }> = [
  { key: "monday", label: "Montag" },
  { key: "tuesday", label: "Dienstag" },
  { key: "wednesday", label: "Mittwoch" },
  { key: "thursday", label: "Donnerstag" },
  { key: "friday", label: "Freitag" },
  { key: "saturday", label: "Samstag" },
  { key: "sunday", label: "Sonntag" },
];

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const celebrationOptions: Array<{ value: CelebrationType; label: string; hint: string }> = [
  { value: "confetti", label: "Konfetti", hint: "Locker und leicht." },
  { value: "checkmark", label: "Checkmark", hint: "Kurz und dezent." },
  { value: "fireworks", label: "Feuerwerk", hint: "Etwas lauter." },
];

type NoticeTone = "success" | "error" | "pending";

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

const cardSubtleStyle = {
  borderColor: "#e4ddd6",
  backgroundColor: "#fffdfa",
} as const;

const dangerCardStyle = {
  borderColor: "#ebd2d2",
  background: "#fff4f4",
} as const;

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatSavedAt(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsDashboard() {
  const { settings, hydrated, lastUpdatedAt, updateSection, updateWorkloadDay, resetSettings } =
    useSettingsStore();
  const {
    calendarCategories,
    fetchCalendarCategories,
    addCalendarCategory,
    updateCalendarCategory,
    deleteCalendarCategory,
    apiAvailable,
  } = useTaskStore();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#8D7CF6");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"json" | "csv" | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deletingDemo, setDeletingDemo] = useState(false);

  useEffect(() => {
    void fetchCalendarCategories();
  }, [fetchCalendarCategories]);

  useEffect(() => {
    if (!deleteArmed) return;

    const timer = window.setTimeout(() => setDeleteArmed(false), 8000);
    return () => window.clearTimeout(timer);
  }, [deleteArmed]);

  if (!hydrated) {
    return (
      <div className="flex h-full min-w-0 flex-1 items-center justify-center p-8">
        <div
          className="inline-flex items-center gap-3 rounded-full px-5 py-3 text-[13px] font-medium"
          style={{
            backgroundColor: "rgba(255, 251, 246, 0.96)",
            color: "var(--text-secondary)",
            boxShadow: "0 18px 28px rgba(88, 75, 57, 0.08)",
          }}
        >
          <LoaderCircle size={16} className="animate-spin" />
          Einstellungen werden vorbereitet
        </div>
      </div>
    );
  }

  const totalWeeklyCapacity = dayMeta.reduce(
    (sum, day) => sum + settings.workload[day.key],
    0
  );
  const weekdayCapacity = dayMeta
    .slice(0, 5)
    .reduce((sum, day) => sum + settings.workload[day.key], 0);
  const celebrationLabel =
    celebrationOptions.find((option) => option.value === settings.celebrations.type)?.label ??
    "Konfetti";
  const workloadBadgeColor =
    totalWeeklyCapacity <= 2100
      ? "var(--accent-success)"
      : totalWeeklyCapacity <= 2580
        ? "var(--accent-warning)"
        : "var(--accent-danger)";

  async function handleExport(format: "json" | "csv") {
    setExportingFormat(format);
    setNotice({
      tone: "pending",
      message: `Export wird als ${format.toUpperCase()} vorbereitet...`,
    });

    try {
      const response = await fetch("/api/export");

      if (!response.ok) {
        throw new Error("export-failed");
      }

      const payload = (await response.json()) as Omit<
        PlannerExportData,
        "exportedAt" | "settings"
      >;

      const exportedAt = new Date().toISOString();
      const bundle: PlannerExportData = {
        ...payload,
        exportedAt,
        settings,
      };

      const dateStamp = exportedAt.slice(0, 10);
      const fileName = `sunsama-export-${dateStamp}.${format}`;
      const isDbFallback = response.headers.get("x-db-unavailable") === "true";

      if (format === "json") {
        triggerDownload(
          `${JSON.stringify(bundle, null, 2)}\n`,
          fileName,
          "application/json;charset=utf-8"
        );
      } else {
        triggerDownload(
          buildPlannerExportCsv(bundle),
          fileName,
          "text/csv;charset=utf-8"
        );
      }

      setNotice({
        tone: "success",
        message: isDbFallback
          ? "Export erstellt. Die Datenbank war nicht erreichbar, deshalb enthaelt die Datei nur den aktuell verfuegbaren Datenstand."
          : `Export als ${format.toUpperCase()} gespeichert.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Der Export konnte nicht erstellt werden.",
      });
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleDemoDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setNotice({
        tone: "pending",
        message: "Noch einmal klicken, um alle Demo-Daten endgueltig zu loeschen.",
      });
      return;
    }

    setDeletingDemo(true);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });

      if (!response.ok) {
        throw new Error("delete-failed");
      }

      useTaskStore.setState((state) => ({
        ...state,
        tasks: [],
        backlogTasks: [],
        events: [],
        channels: [],
        calendarCategories: [],
      }));
      useObjectiveStore.setState({ objectives: [], loading: false });
      setDeleteArmed(false);
      setNotice({
        tone: "success",
        message: "Die Demo-Daten wurden entfernt. Deine lokalen Einstellungen bleiben erhalten.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Die Demo-Daten konnten nicht geloescht werden.",
      });
    } finally {
      setDeletingDemo(false);
    }
  }

  async function handleAddCategory(event: React.FormEvent) {
    event.preventDefault();

    const name = newCategoryName.trim();
    if (!name) return;

    await addCalendarCategory({
      name,
      color: newCategoryColor,
    });

    setNewCategoryName("");
    setNewCategoryColor("#8D7CF6");
  }

  return (
    <div className="workspace-page settings-workspace-page">
      <div className="workspace-page__header">
        <div className="workspace-page__intro">
          <p className="workspace-page__eyebrow">Preferences</p>
          <h1 className="workspace-page__title workspace-page__title--wide">
            Einstellungen fuer einen ruhigen Arbeitstag
          </h1>
          <p className="workspace-page__copy">
            Profil, Rituale, Workload, Fokus und Datenverwaltung an einem Ort. Alles
            wird lokal gespeichert und bleibt direkt beim Arbeiten spuerbar.
          </p>
          <div className="workspace-page__meta">
            <Badge
              label={`Zuletzt gespeichert ${formatSavedAt(lastUpdatedAt)}`}
              tone="neutral"
            />
            <Badge label={`${settings.display.themeMode} Theme`} tone="neutral" />
            <Badge label={`${settings.display.timeFormat} / ${settings.display.language.toUpperCase()}`} tone="neutral" />
            <Badge label={celebrationLabel} tone="accent" />
          </div>
        </div>

      </div>

      <div className="workspace-page__scroll">
        <div className="workspace-page__content workspace-page__content--wide">
          <div className="workspace-page__stack settings-page-stack">
            <AnimatedPanel index={0}>
              <SummaryHeroCard
                weeklyCapacity={formatMinutes(totalWeeklyCapacity)}
                weekdayCapacity={formatMinutes(weekdayCapacity)}
                planningTime={settings.planning.planningTime}
                pomodoroMinutes={settings.focus.pomodoroMinutes}
                defaultEventDuration={settings.calendar.defaultEventDuration}
              />
            </AnimatedPanel>

            <div className="settings-panel-grid settings-panel-grid--balanced">
              <AnimatedPanel index={1}>
              <SectionCard
                icon={<User size={17} strokeWidth={1.8} />}
                eyebrow="Profil"
                title="Identitaet und Kontakt"
              >
                <div className="space-y-4">
                  <div
                    className="workspace-surface flex items-center gap-4 p-4 md:p-5"
                    style={cardSubtleStyle}
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] text-[20px] font-semibold"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(141, 124, 246, 0.18), rgba(244, 173, 70, 0.16))",
                        color: "var(--text-primary)",
                      }}
                    >
                      {(settings.profile.avatar || settings.profile.name)
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p
                        className="text-[15px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {settings.profile.name || "Dein Profil"}
                      </p>
                      <p
                        className="text-[12.5px] leading-6"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Die Angaben werden lokal gehalten und fuer spaetere Account-Profile
                        vorbereitet.
                      </p>
                    </div>
                  </div>

                  <TextField
                    label="Name"
                    value={settings.profile.name}
                    onChange={(value) => updateSection("profile", { name: value })}
                    placeholder="Dein Name"
                  />
                  <TextField
                    label="E-Mail"
                    type="email"
                    value={settings.profile.email}
                    onChange={(value) => updateSection("profile", { email: value })}
                    placeholder="name@example.com"
                    icon={<Mail size={14} strokeWidth={1.8} />}
                  />
                  <TextField
                    label="Avatar-Kuerzel"
                    value={settings.profile.avatar}
                    onChange={(value) =>
                      updateSection("profile", { avatar: value.slice(0, 3).toUpperCase() })
                    }
                    placeholder="NL"
                  />
                </div>
              </SectionCard>
            </AnimatedPanel>

              <AnimatedPanel index={2}>
              <SectionCard
                icon={<Sun size={17} strokeWidth={1.8} />}
                eyebrow="Display"
                title="Theme, Sprache und Zeit"
              >
                <div className="space-y-5">
                  <SegmentedControl
                    label="Theme-Modus"
                    value={settings.display.themeMode}
                    options={themeOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                      icon: <option.icon size={15} strokeWidth={1.8} />,
                    }))}
                    onChange={(value) =>
                      updateSection("display", { themeMode: value as ThemeMode })
                    }
                    columns={3}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SegmentedControl
                      label="Wochenstart"
                      value={settings.display.weekStart}
                      options={[
                        { value: "monday", label: "Montag" },
                        { value: "sunday", label: "Sonntag" },
                      ]}
                      onChange={(value) =>
                        updateSection("display", {
                          weekStart: value as "monday" | "sunday",
                        })
                      }
                      columns={2}
                    />

                    <SegmentedControl
                      label="Zeitformat"
                      value={settings.display.timeFormat}
                      options={[
                        { value: "24h", label: "24h" },
                        { value: "12h", label: "12h" },
                      ]}
                      onChange={(value) =>
                        updateSection("display", {
                          timeFormat: value as "24h" | "12h",
                        })
                      }
                      columns={2}
                    />
                  </div>

                  <SegmentedControl
                    label="Sprache"
                    value={settings.display.language}
                    options={[
                      { value: "de", label: "Deutsch", icon: <Globe size={14} /> },
                      { value: "en", label: "English", icon: <Globe size={14} /> },
                    ]}
                    onChange={(value) =>
                      updateSection("display", { language: value as "de" | "en" })
                    }
                    columns={2}
                  />
                </div>
              </SectionCard>
            </AnimatedPanel>

            <AnimatedPanel index={3}>
              <SectionCard
                icon={<CalendarDays size={17} strokeWidth={1.8} />}
                eyebrow="Planning"
                title="Rituale und Rollover"
              >
                <div className="space-y-5">
                  <TextField
                    label="Planungszeit"
                    type="time"
                    value={settings.planning.planningTime}
                    onChange={(value) => updateSection("planning", { planningTime: value })}
                    icon={<Clock3 size={14} strokeWidth={1.8} />}
                  />

                  <ToggleRow
                    label="Auto-Rollover"
                    description="Unerledigte Aufgaben sollen automatisch in den naechsten Tag rueberwandern."
                    checked={settings.planning.autoRollover}
                    onToggle={() =>
                      updateSection("planning", {
                        autoRollover: !settings.planning.autoRollover,
                      })
                    }
                  />

                  <SegmentedControl
                    label="Rollover-Position"
                    value={settings.planning.rolloverPosition}
                    options={[
                      { value: "top", label: "Oben einsortieren" },
                      { value: "bottom", label: "Unten einsortieren" },
                    ]}
                    onChange={(value) =>
                      updateSection("planning", {
                        rolloverPosition: value as "top" | "bottom",
                      })
                    }
                    columns={2}
                  />
                </div>
              </SectionCard>
            </AnimatedPanel>

            <AnimatedPanel index={4}>
              <SectionCard
                icon={<Target size={17} strokeWidth={1.8} />}
                eyebrow="Focus"
                title="Pomodoro und Break-Reminder"
              >
                <div className="space-y-5">
                  <RangeField
                    label="Pomodoro-Dauer"
                    value={settings.focus.pomodoroMinutes}
                    min={10}
                    max={60}
                    step={5}
                    onChange={(value) =>
                      updateSection("focus", { pomodoroMinutes: value })
                    }
                    suffix="Min"
                  />

                  <RangeField
                    label="Break-Reminder"
                    value={settings.focus.breakReminderMinutes}
                    min={20}
                    max={120}
                    step={5}
                    onChange={(value) =>
                      updateSection("focus", { breakReminderMinutes: value })
                    }
                    suffix="Min"
                  />

                  <ToggleRow
                    label="Auto-Focus bei Timer-Start"
                    description="Wechselt direkt in einen konzentrierten Modus, sobald du den Timer startest."
                    checked={settings.focus.autoFocusOnTimerStart}
                    onToggle={() =>
                      updateSection("focus", {
                        autoFocusOnTimerStart: !settings.focus.autoFocusOnTimerStart,
                      })
                    }
                  />
                </div>
              </SectionCard>
            </AnimatedPanel>

            <AnimatedPanel index={5} className="settings-panel-span">
              <SectionCard
                icon={<Clock3 size={17} strokeWidth={1.8} />}
                eyebrow="Workload"
                title="Taegliche Kapazitaet pro Wochentag"
              >
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-4">
                    {dayMeta.map((day) => (
                      <WorkloadRow
                        key={day.key}
                        label={day.label}
                        value={settings.workload[day.key]}
                        onChange={(value) => updateWorkloadDay(day.key, value)}
                      />
                    ))}
                  </div>

                  <div
                    className="rounded-[28px] border p-5"
                    style={{
                      borderColor: "rgba(227, 218, 209, 0.92)",
                      background:
                        "radial-gradient(circle at top right, rgba(255,255,255,0.92), transparent 46%), rgba(255, 251, 247, 0.92)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Wochenbild
                    </p>
                    <p
                      className="mt-4 text-[34px] font-semibold leading-[0.95] tracking-[-0.07em]"
                      style={{ color: workloadBadgeColor }}
                    >
                      {formatMinutes(totalWeeklyCapacity)}
                    </p>
                    <p
                      className="mt-3 text-[13px] leading-6"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatMinutes(weekdayCapacity)} auf Werktage verteilt. Das Limit
                      bleibt ruhig, solange du unter deinem Tagesrahmen planst.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </AnimatedPanel>

            <AnimatedPanel index={6} className="settings-panel-span">
              <SectionCard
                icon={<Bell size={17} strokeWidth={1.8} />}
                eyebrow="Signals"
                title="Benachrichtigungen und Belohnung"
              >
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                  <div className="space-y-2">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Notifications
                    </p>
                    <ToggleRow
                      label="Planning-Ritual"
                      description="Erinnert dich morgens an deine taegliche Planung."
                      checked={settings.notifications.planningReminder}
                      onToggle={() =>
                        updateSection("notifications", {
                          planningReminder: !settings.notifications.planningReminder,
                        })
                      }
                    />
                    <ToggleRow
                      label="Timer fertig"
                      description="Benachrichtigt dich, sobald ein Fokusblock endet."
                      checked={settings.notifications.timerDone}
                      onToggle={() =>
                        updateSection("notifications", {
                          timerDone: !settings.notifications.timerDone,
                        })
                      }
                    />
                    <ToggleRow
                      label="Faellige Aufgaben"
                      description="Hebt anstehende Deadlines hervor."
                      checked={settings.notifications.taskDue}
                      onToggle={() =>
                        updateSection("notifications", {
                          taskDue: !settings.notifications.taskDue,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Celebrations
                      </p>
                      <ToggleRow
                        label="Animationen aktiv"
                        description="Feine Rueckmeldung bei erledigten Tagen, Ritualen und vollen Listen."
                        checked={settings.celebrations.enabled}
                        onToggle={() =>
                          updateSection("celebrations", {
                            enabled: !settings.celebrations.enabled,
                          })
                        }
                      />
                    </div>

                    <SegmentedControl
                      label="Animationstyp"
                      value={settings.celebrations.type}
                      options={celebrationOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                        hint: option.hint,
                      }))}
                      onChange={(value) =>
                        updateSection("celebrations", {
                          type: value as CelebrationType,
                        })
                      }
                      columns={3}
                    />
                  </div>
                </div>
              </SectionCard>
            </AnimatedPanel>
          </div>

            <div className="settings-panel-grid settings-panel-grid--support">
              <AnimatedPanel index={7}>
              <SectionCard
                icon={<Palette size={17} strokeWidth={1.8} />}
                eyebrow="Calendar"
                title="Standarddauer und Farbpaletten"
              >
                <div className="space-y-5">
                  <RangeField
                    label="Standard-Eventdauer"
                    value={settings.calendar.defaultEventDuration}
                    min={15}
                    max={120}
                    step={15}
                    onChange={(value) =>
                      updateSection("calendar", { defaultEventDuration: value })
                    }
                    suffix="Min"
                  />

                  <form onSubmit={handleAddCategory} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_92px]">
                      <TextField
                        label="Neue Kalenderfarbe"
                        value={newCategoryName}
                        onChange={setNewCategoryName}
                        placeholder="Deep Work, Calls, Studium..."
                      />
                      <label className="block space-y-2">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Farbe
                        </span>
                        <input
                          type="color"
                          value={newCategoryColor}
                          onChange={(event) => setNewCategoryColor(event.target.value)}
                          className="h-[46px] w-full rounded-[16px] border bg-transparent p-1"
                          style={{
                            borderColor: "rgba(226, 218, 209, 0.95)",
                            backgroundColor: "rgba(255, 252, 248, 0.94)",
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px]"
                      style={{
                        backgroundColor: "var(--accent-primary)",
                        color: "white",
                      }}
                    >
                      <Palette size={13} />
                      Farbe anlegen
                    </button>
                  </form>

                  <div className="space-y-3">
                    {calendarCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center gap-3 rounded-[22px] border p-3"
                        style={cardSubtleStyle}
                      >
                        <input
                          type="color"
                          value={category.color}
                          onChange={(event) =>
                            void updateCalendarCategory(category.id, {
                              color: event.target.value,
                            })
                          }
                          className="h-11 w-11 shrink-0 rounded-[14px] border bg-transparent p-1"
                          style={{
                            borderColor: "rgba(226, 218, 209, 0.95)",
                          }}
                          aria-label={`Farbe fuer ${category.name}`}
                        />
                        <input
                          value={category.name}
                          onChange={(event) =>
                            void updateCalendarCategory(category.id, {
                              name: event.target.value,
                            })
                          }
                          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none"
                          style={{ color: "var(--text-primary)" }}
                          aria-label="Kalendername"
                        />
                        <button
                          type="button"
                          onClick={() => void deleteCalendarCategory(category.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
                          style={{ color: "var(--text-muted)" }}
                          aria-label={`${category.name} loeschen`}
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
                    {apiAvailable
                      ? "Kalenderfarben werden mit dem aktuellen Datenstand synchron gehalten."
                      : "Die Datenbank ist gerade nicht verfuegbar. Farb-Aenderungen laufen lokal weiter."}
                  </p>
                </div>
              </SectionCard>
            </AnimatedPanel>

              <AnimatedPanel index={8}>
              <SectionCard
                icon={<Download size={17} strokeWidth={1.8} />}
                eyebrow="Data"
                title="Export und Schutzschalter"
              >
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <ActionButton
                      label={exportingFormat === "json" ? "JSON wird erstellt..." : "Export als JSON"}
                      description="Vollstaendiger Snapshot inklusive Einstellungen."
                      icon={<Download size={14} strokeWidth={1.8} />}
                      onClick={() => void handleExport("json")}
                      disabled={Boolean(exportingFormat) || deletingDemo}
                    />
                    <ActionButton
                      label={exportingFormat === "csv" ? "CSV wird erstellt..." : "Export als CSV"}
                      description="Tabellarische Ausgabe fuer Import und Auswertung."
                      icon={<Download size={14} strokeWidth={1.8} />}
                      onClick={() => void handleExport("csv")}
                      disabled={Boolean(exportingFormat) || deletingDemo}
                    />
                  </div>

                  {notice && <NoticeBanner notice={notice} />}

                  <div className="workspace-surface workspace-surface--danger p-4" style={dangerCardStyle}>
                    <div className="space-y-2">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        Demo-Workspace leeren
                      </p>
                      <p className="text-[12.5px] leading-6" style={{ color: "var(--text-muted)" }}>
                        Entfernt Aufgaben, Ziele, Events, Channels und Kalenderfarben aus dem
                        Demo-Account. Lokale Einstellungen bleiben bestehen.
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDemoDelete()}
                        disabled={deletingDemo || Boolean(exportingFormat)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          backgroundColor: deleteArmed
                            ? "var(--accent-danger)"
                            : "rgba(255, 241, 241, 0.96)",
                          color: deleteArmed ? "white" : "var(--accent-danger)",
                        }}
                      >
                        {deletingDemo ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.8} />
                        )}
                        {deleteArmed ? "Wirklich alles loeschen" : "Demo-Daten loeschen"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          resetSettings();
                          setNotice({
                            tone: "success",
                            message: "Alle Einstellungen wurden auf die Standardwerte zurueckgesetzt.",
                          });
                        }}
                        disabled={deletingDemo || Boolean(exportingFormat)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold"
                        style={{
                          backgroundColor: "rgba(244, 239, 232, 0.92)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Repeat size={14} strokeWidth={1.8} />
                        Defaults wiederherstellen
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </AnimatedPanel>
          </div>

            <AnimatedPanel index={9} className="settings-panel-span">
              <SectionCard
                icon={<CalendarDays size={17} strokeWidth={1.8} />}
                eyebrow="Integrations"
                title="FocusPomo - Apple Kalender"
              >
                <FocusPomoSync />
              </SectionCard>
            </AnimatedPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedPanel({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.03 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SummaryHeroCard({
  weeklyCapacity,
  weekdayCapacity,
  planningTime,
  pomodoroMinutes,
  defaultEventDuration,
}: {
  weeklyCapacity: string;
  weekdayCapacity: string;
  planningTime: string;
  pomodoroMinutes: number;
  defaultEventDuration: number;
}) {
  return (
    <section className="workspace-surface workspace-section settings-hero-card">
      <div className="settings-hero-card__intro">
        <p className="workspace-section__eyebrow">Current Rhythm</p>
        <h2 className="settings-hero-card__title">Dein aktueller Arbeitsrahmen</h2>
        <p className="settings-hero-card__copy">
          Die wichtigsten Defaults und Kapazitaeten liegen hier in einem ruhigen
          Ueberblick, bevor du tiefer in einzelne Bereiche gehst.
        </p>
      </div>

      <div className="settings-hero-card__metrics">
        <StatTile
          label="Wochenkapazitaet"
          value={weeklyCapacity}
          detail={`${weekdayCapacity} auf Werktage verteilt`}
          accent="var(--accent-success)"
        />
        <StatTile
          label="Planning"
          value={planningTime}
          detail="Startpunkt fuer deinen Morgen-Flow"
          accent="var(--accent-primary)"
        />
        <StatTile
          label="Pomodoro"
          value={`${pomodoroMinutes}m`}
          detail="Default fuer konzentrierte Sessions"
          accent="var(--accent-warning)"
        />
        <StatTile
          label="Default-Event"
          value={`${defaultEventDuration}m`}
          detail="Schneller Standard fuer Kalenderbloecke"
          accent="var(--accent-success)"
        />
      </div>
    </section>
  );
}

function SectionCard({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-surface workspace-section">
      <div className="workspace-section__header">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{
            backgroundColor: "rgba(244, 239, 232, 0.92)",
            color: "var(--accent-primary)",
          }}
        >
          {icon}
        </span>
        <div className="workspace-section__intro">
          <p className="workspace-section__eyebrow">{eyebrow}</p>
          <h2 className="workspace-section__title">{title}</h2>
        </div>
      </div>

      <div className="workspace-section__body">{children}</div>
    </section>
  );
}

function Badge({ label, tone }: { label: string; tone: "neutral" | "accent" }) {
  return (
    <span
      className={`workspace-badge ${tone === "accent" ? "workspace-badge--accent" : ""}`}
      style={
        tone === "accent"
          ? {
              backgroundColor: "var(--accent-primary-light)",
              color: "var(--accent-primary)",
            }
          : {
              color: "var(--text-secondary)",
            }
      }
    >
      {label}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        {icon && <span style={{ color: "var(--text-muted)" }}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="workspace-input min-w-0 flex-1"
        />
      </div>
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <label className="block space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        <span className="workspace-badge">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--accent-primary)]"
      />
    </label>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: string;
  options: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
    hint?: string;
  }>;
  onChange: (value: string) => void;
  columns: 2 | 3;
}) {
  return (
    <div className="space-y-2.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          const pillClassName =
            columns === 3
              ? "sm:min-w-[120px]"
              : "sm:min-w-[148px]";

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`workspace-button h-auto min-h-0 px-4 py-2.5 text-left text-[13px] font-medium ${pillClassName}`}
              style={
                active
                  ? {
                      backgroundColor: "rgba(240, 235, 255, 0.95)",
                      color: "var(--accent-primary)",
                      boxShadow: "0 8px 16px rgba(141, 124, 246, 0.1)",
                    }
                  : {
                      color: "var(--text-secondary)",
                    }
              }
            >
              <div className="flex items-center gap-2">
                {option.icon && (
                  <span>{option.icon}</span>
                )}
                <span>{option.label}</span>
              </div>
            </button>
          );
        })}
      </div>
      {options.find((option) => option.value === value)?.hint && (
        <p className="text-[12px] leading-6" style={{ color: "var(--text-muted)" }}>
          {options.find((option) => option.value === value)?.hint}
        </p>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b py-3.5"
      style={{ borderColor: "rgba(226, 218, 209, 0.95)" }}
    >
      <div className="space-y-1">
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-[12.5px] leading-6" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        style={{
          backgroundColor: checked
            ? "var(--accent-primary)"
            : "rgba(217, 209, 200, 0.82)",
        }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-150"
          style={{ left: checked ? "calc(100% - 24px)" : "4px" }}
        />
      </button>
    </div>
  );
}

function StatTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div
      className="settings-hero-stat"
      style={{
        borderColor: "rgba(226, 218, 209, 0.9)",
        backgroundColor: "#fffdfa",
      }}
    >
      <div className="min-w-0">
        <p
          className="settings-hero-stat__label"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
      </div>
      <p className="settings-hero-stat__value" style={{ color: accent }}>
        {value}
      </p>
      <p className="settings-hero-stat__detail" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function WorkloadRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const tone =
    value <= 360
      ? "var(--accent-success)"
      : value <= 510
        ? "var(--accent-warning)"
        : "var(--accent-danger)";

  return (
    <div className="border-b pb-4" style={{ borderColor: "rgba(226, 218, 209, 0.92)" }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <span className="workspace-badge">
          {formatMinutes(value)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={720}
        step={15}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[var(--accent-primary)]"
      />
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(236, 230, 222, 0.92)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (value / 720) * 100)}%`,
            backgroundColor: tone,
          }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  description,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="workspace-surface px-4 py-4 text-left transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
      style={cardSubtleStyle}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--accent-primary)" }}>{icon}</span>
        <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-6" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
    </button>
  );
}

function NoticeBanner({ notice }: { notice: NoticeState }) {
  const colorMap: Record<NoticeTone, { border: string; background: string; text: string }> = {
    success: {
      border: "rgba(106, 180, 130, 0.32)",
      background: "rgba(239, 248, 242, 0.96)",
      text: "#3f7d56",
    },
    error: {
      border: "rgba(224, 111, 111, 0.28)",
      background: "rgba(255, 240, 240, 0.98)",
      text: "#b45454",
    },
    pending: {
      border: "rgba(244, 173, 70, 0.3)",
      background: "rgba(255, 245, 230, 0.98)",
      text: "#9f6f24",
    },
  };

  const colors = colorMap[notice.tone];

  return (
    <div
      className="workspace-note px-4 py-3 text-[12.5px] leading-6"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      {notice.message}
    </div>
  );
}

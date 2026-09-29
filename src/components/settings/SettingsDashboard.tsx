"use client";

import { useEffect, useState } from "react";
import {
  Download,
  LoaderCircle,
  Monitor,
  Moon,
  Plus,
  Repeat,
  Sun,
  Trash2,
} from "lucide-react";
import { buildPlannerExportCsv } from "@/lib/planner-export";
import { useObjectiveStore } from "@/stores/objectiveStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTaskStore } from "@/stores/taskStore";
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
        <span className="workspace-badge">
          <LoaderCircle size={14} className="animate-spin" />
          Einstellungen werden geladen
        </span>
      </div>
    );
  }

  const totalWeeklyCapacity = dayMeta.reduce(
    (sum, day) => sum + settings.workload[day.key],
    0
  );
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
    <div className="workspace-page">
      <div className="planning-toolbar">
        <span className="settings-toolbar__title">Einstellungen</span>
        <span className="planning-card__duration">
          Gespeichert {formatSavedAt(lastUpdatedAt)}
        </span>
      </div>

      <div className="workspace-page__scroll">
        <div className="settings-columns">
          <SettingsSection title="Profil" subtitle={"Wie du im Planer erscheinst"}>
            <div className="settings-profile">
              <div className="settings-profile__avatar">
                {(settings.profile.avatar || settings.profile.name).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="settings-row__label">{settings.profile.name || "Dein Profil"}</p>
                <p className="settings-row__description">
                  {settings.profile.email || "Noch keine E-Mail hinterlegt"}
                </p>
              </div>
            </div>
            <SettingRow label="Name">
              <TextInput
                value={settings.profile.name}
                onChange={(value) => updateSection("profile", { name: value })}
                placeholder="Dein Name"
              />
            </SettingRow>
            <SettingRow label="E-Mail">
              <TextInput
                type="email"
                value={settings.profile.email}
                onChange={(value) => updateSection("profile", { email: value })}
                placeholder="name@example.com"
              />
            </SettingRow>
            <SettingRow label="Avatar-Kuerzel" description="Bis zu drei Buchstaben.">
              <TextInput
                value={settings.profile.avatar}
                onChange={(value) =>
                  updateSection("profile", { avatar: value.slice(0, 3).toUpperCase() })
                }
                placeholder="NL"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Darstellung" subtitle={"Theme, Sprache und Zeit"}>
            <SettingRow label="Theme">
              <SegmentedControl
                value={settings.display.themeMode}
                options={themeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  icon: <option.icon size={14} strokeWidth={2} />,
                }))}
                onChange={(value) => updateSection("display", { themeMode: value as ThemeMode })}
              />
            </SettingRow>
            <SettingRow label="Wochenstart">
              <SegmentedControl
                value={settings.display.weekStart}
                options={[
                  { value: "monday", label: "Montag" },
                  { value: "sunday", label: "Sonntag" },
                ]}
                onChange={(value) =>
                  updateSection("display", { weekStart: value as "monday" | "sunday" })
                }
              />
            </SettingRow>
            <SettingRow label="Zeitformat">
              <SegmentedControl
                value={settings.display.timeFormat}
                options={[
                  { value: "24h", label: "24h" },
                  { value: "12h", label: "12h" },
                ]}
                onChange={(value) =>
                  updateSection("display", { timeFormat: value as "24h" | "12h" })
                }
              />
            </SettingRow>
            <SettingRow label="Sprache">
              <SegmentedControl
                value={settings.display.language}
                options={[
                  { value: "de", label: "Deutsch" },
                  { value: "en", label: "English" },
                ]}
                onChange={(value) => updateSection("display", { language: value as "de" | "en" })}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Planung" subtitle={"Rituale und Rollover"}>
            <SettingRow label="Planungszeit" description="Startpunkt fuer deinen Morgen.">
              <TextInput
                type="time"
                value={settings.planning.planningTime}
                onChange={(value) => updateSection("planning", { planningTime: value })}
              />
            </SettingRow>
            <SettingRow inline
              label="Auto-Rollover"
              description="Unerledigte Aufgaben wandern automatisch in den naechsten Tag."
            >
              <Switch
                checked={settings.planning.autoRollover}
                onToggle={() =>
                  updateSection("planning", { autoRollover: !settings.planning.autoRollover })
                }
              />
            </SettingRow>
            <SettingRow label="Rollover-Position">
              <SegmentedControl
                value={settings.planning.rolloverPosition}
                options={[
                  { value: "top", label: "Oben" },
                  { value: "bottom", label: "Unten" },
                ]}
                onChange={(value) =>
                  updateSection("planning", { rolloverPosition: value as "top" | "bottom" })
                }
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Fokus" subtitle={"Pomodoro und Pausen"}>
            <SettingRow label="Pomodoro-Dauer">
              <RangeInput
                value={settings.focus.pomodoroMinutes}
                min={10}
                max={60}
                step={5}
                onChange={(value) => updateSection("focus", { pomodoroMinutes: value })}
                display={`${settings.focus.pomodoroMinutes} Min`}
              />
            </SettingRow>
            <SettingRow label="Break-Reminder">
              <RangeInput
                value={settings.focus.breakReminderMinutes}
                min={20}
                max={120}
                step={5}
                onChange={(value) => updateSection("focus", { breakReminderMinutes: value })}
                display={`${settings.focus.breakReminderMinutes} Min`}
              />
            </SettingRow>
            <SettingRow inline
              label="Auto-Focus bei Timer-Start"
              description="Wechselt in den Fokusmodus, sobald du den Timer startest."
            >
              <Switch
                checked={settings.focus.autoFocusOnTimerStart}
                onToggle={() =>
                  updateSection("focus", {
                    autoFocusOnTimerStart: !settings.focus.autoFocusOnTimerStart,
                  })
                }
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            title="Kapazitaet"
            subtitle={
              <span style={{ color: workloadBadgeColor }}>
                {formatMinutes(totalWeeklyCapacity)} pro Woche
              </span>
            }
          >
            {dayMeta.map((day) => (
              <SettingRow key={day.key} label={day.label}>
                <RangeInput
                  value={settings.workload[day.key]}
                  min={0}
                  max={720}
                  step={15}
                  onChange={(value) => updateWorkloadDay(day.key, value)}
                  display={formatMinutes(settings.workload[day.key])}
                  tone={workloadTone(settings.workload[day.key])}
                />
              </SettingRow>
            ))}
          </SettingsSection>

          <SettingsSection title="Benachrichtigungen" subtitle={"Erinnerungen und Feedback"}>
            <SettingRow inline label="Planning-Ritual" description="Erinnert dich morgens an deine Planung.">
              <Switch
                checked={settings.notifications.planningReminder}
                onToggle={() =>
                  updateSection("notifications", {
                    planningReminder: !settings.notifications.planningReminder,
                  })
                }
              />
            </SettingRow>
            <SettingRow inline label="Shutdown-Ritual" description="Hinweis zum Tagesabschluss am Abend.">
              <Switch
                checked={settings.notifications.shutdownReminder}
                onToggle={() =>
                  updateSection("notifications", {
                    shutdownReminder: !settings.notifications.shutdownReminder,
                  })
                }
              />
            </SettingRow>
            <SettingRow inline label="Timer fertig" description="Sobald ein Fokusblock endet.">
              <Switch
                checked={settings.notifications.timerDone}
                onToggle={() =>
                  updateSection("notifications", {
                    timerDone: !settings.notifications.timerDone,
                  })
                }
              />
            </SettingRow>
            <SettingRow inline label="Faellige Aufgaben" description="Hebt anstehende Deadlines hervor.">
              <Switch
                checked={settings.notifications.taskDue}
                onToggle={() =>
                  updateSection("notifications", {
                    taskDue: !settings.notifications.taskDue,
                  })
                }
              />
            </SettingRow>
            <SettingRow inline
              label="Animationen"
              description="Rueckmeldung bei erledigten Tagen und Ritualen."
            >
              <Switch
                checked={settings.celebrations.enabled}
                onToggle={() =>
                  updateSection("celebrations", { enabled: !settings.celebrations.enabled })
                }
              />
            </SettingRow>
            <SettingRow
              label="Animationstyp"
              description={
                celebrationOptions.find((option) => option.value === settings.celebrations.type)
                  ?.hint
              }
            >
              <SegmentedControl
                value={settings.celebrations.type}
                options={celebrationOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onChange={(value) =>
                  updateSection("celebrations", { type: value as CelebrationType })
                }
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Kalender" subtitle={"Dauer und Farben"}>
            <SettingRow label="Standard-Eventdauer">
              <RangeInput
                value={settings.calendar.defaultEventDuration}
                min={15}
                max={120}
                step={15}
                onChange={(value) => updateSection("calendar", { defaultEventDuration: value })}
                display={`${settings.calendar.defaultEventDuration} Min`}
              />
            </SettingRow>

            <div className="settings-block">
              <p className="settings-row__label">Kalenderfarben</p>
              <div className="settings-category-list">
                {calendarCategories.map((category) => (
                  <div key={category.id} className="settings-category">
                    <input
                      type="color"
                      value={category.color}
                      onChange={(event) =>
                        void updateCalendarCategory(category.id, { color: event.target.value })
                      }
                      className="settings-color"
                      aria-label={`Farbe fuer ${category.name}`}
                    />
                    <input
                      value={category.name}
                      onChange={(event) =>
                        void updateCalendarCategory(category.id, { name: event.target.value })
                      }
                      className="settings-category__name"
                      aria-label="Kalendername"
                    />
                    <button
                      type="button"
                      onClick={() => void deleteCalendarCategory(category.id)}
                      className="planning-toolbar__button planning-toolbar__button--icon"
                      aria-label={`${category.name} loeschen`}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddCategory} className="settings-category-form">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(event) => setNewCategoryColor(event.target.value)}
                  className="settings-color"
                  aria-label="Farbe"
                />
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Deep Work, Calls, Studium..."
                  className="workspace-input min-w-0 flex-1"
                />
                <button type="submit" className="workspace-button workspace-button--primary">
                  <Plus size={14} strokeWidth={2.2} />
                  Anlegen
                </button>
              </form>

              {!apiAvailable && (
                <p className="settings-row__description">
                  Die Datenbank ist gerade nicht verfuegbar. Farb-Aenderungen laufen lokal weiter.
                </p>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Daten" subtitle={"Export und Zuruecksetzen"}>
            <SettingRow label="Export" description="Snapshot aller Aufgaben inklusive Einstellungen.">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleExport("json")}
                  disabled={Boolean(exportingFormat) || deletingDemo}
                  className="workspace-button"
                >
                  <Download size={14} strokeWidth={2} />
                  {exportingFormat === "json" ? "Wird erstellt..." : "JSON"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport("csv")}
                  disabled={Boolean(exportingFormat) || deletingDemo}
                  className="workspace-button"
                >
                  <Download size={14} strokeWidth={2} />
                  {exportingFormat === "csv" ? "Wird erstellt..." : "CSV"}
                </button>
              </div>
            </SettingRow>
            <SettingRow
              label="Standardwerte"
              description="Setzt alle Einstellungen zurueck. Deine Daten bleiben erhalten."
            >
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
                className="workspace-button"
              >
                <Repeat size={14} strokeWidth={2} />
                Zuruecksetzen
              </button>
            </SettingRow>
            <SettingRow
              label="Alle Daten loeschen"
              description="Entfernt Aufgaben, Ziele, Events, Channels und Kalenderfarben."
            >
              <button
                type="button"
                onClick={() => void handleDemoDelete()}
                disabled={deletingDemo || Boolean(exportingFormat)}
                className={`workspace-button settings-danger-button ${deleteArmed ? "settings-danger-button--armed" : ""}`}
              >
                {deletingDemo ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} strokeWidth={2} />
                )}
                {deleteArmed ? "Wirklich loeschen" : "Loeschen"}
              </button>
            </SettingRow>

            {notice && <NoticeBanner notice={notice} />}
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

function workloadTone(minutes: number) {
  if (minutes <= 360) return "var(--accent-success)";
  if (minutes <= 510) return "var(--accent-warning)";
  return "var(--accent-danger)";
}

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section__inner">
        <h2 className="planning-column__title">{title}</h2>
        <p className="planning-column__date">{subtitle}</p>
        <div className="settings-section__body">{children}</div>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  inline = false,
  children,
}: {
  label: string;
  description?: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={inline ? "settings-row settings-row--inline" : "settings-row"}>
      <div className="settings-row__text">
        <p className="settings-row__label">{label}</p>
        {description && <p className="settings-row__description">{description}</p>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="workspace-input settings-input"
    />
  );
}

function RangeInput({
  value,
  min,
  max,
  step,
  onChange,
  display,
  tone,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
  tone?: string;
}) {
  return (
    <div className="settings-range">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="settings-range__input"
      />
      <span className="planning-card__duration settings-range__value" style={tone ? { color: tone } : undefined}>
        {display}
      </span>
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className="settings-segmented__option"
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="settings-switch"
    >
      <span className="settings-switch__thumb" />
    </button>
  );
}

function NoticeBanner({ notice }: { notice: NoticeState }) {
  const toneClass: Record<NoticeTone, string> = {
    success: "workspace-badge--success",
    error: "workspace-badge--danger",
    pending: "workspace-badge--warning",
  };

  return <p className={`settings-notice ${toneClass[notice.tone]}`}>{notice.message}</p>;
}

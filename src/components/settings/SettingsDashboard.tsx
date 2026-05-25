"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Clock3,
  Download,
  Globe,
  Hash,
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

const COLOR_PRIMARY = "var(--text-primary)";
const COLOR_SECONDARY = "var(--text-secondary)";
const COLOR_MUTED = "var(--text-muted)";
const CARD_BORDER = "1px solid #e4ddd6";
const CARD_BG = "#ffffff";
const CARD_SHADOW = "0 1px 0 rgba(89, 72, 48, 0.04)";
const RULE = "1px solid #efe8e0";

const boardStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  flexDirection: "column",
  background: "#fffdfa",
};

const scrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  background: "#fffdfa",
};

const inner: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  padding: "28px 28px 40px",
  display: "flex",
  flexDirection: "column",
  gap: 26,
};

const cardBase: CSSProperties = {
  border: CARD_BORDER,
  borderRadius: 8,
  background: CARD_BG,
  boxShadow: CARD_SHADOW,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 24,
  paddingBottom: 4,
  borderBottom: RULE,
};

const titleStyle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 36,
  fontWeight: 800,
  lineHeight: 0.96,
  letterSpacing: "-0.065em",
};

const subtitleStyle: CSSProperties = {
  marginTop: 8,
  maxWidth: "52ch",
  color: COLOR_SECONDARY,
  fontSize: 15,
  letterSpacing: "-0.025em",
  lineHeight: 1.5,
};

const pillsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  paddingBottom: 10,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(244, 239, 232, 0.85)",
  color: COLOR_SECONDARY,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const statsRow: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
};

const statTile: CSSProperties = {
  ...cardBase,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "16px 18px",
};

const statLabel: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const statValue: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 26,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "-0.045em",
};

const statHint: CSSProperties = {
  marginTop: 2,
  color: COLOR_SECONDARY,
  fontSize: 12,
  lineHeight: 1.45,
};

const block: CSSProperties = {
  ...cardBase,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: "22px 26px 26px",
};

const blockHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
};

const blockHeading: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minWidth: 0,
};

const blockTitle: CSSProperties = {
  color: COLOR_PRIMARY,
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: "-0.03em",
};

const blockHint: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "-0.015em",
  textAlign: "right",
};

const grid2: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const noteStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 16px",
  border: CARD_BORDER,
  borderRadius: 8,
  background: CARD_BG,
  color: COLOR_SECONDARY,
  fontSize: 13,
};

const toolbarLabelStyle: CSSProperties = {
  color: COLOR_SECONDARY,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const toolbarDateStyle: CSSProperties = {
  color: COLOR_SECONDARY,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const cardSubtleStyle = {
  borderColor: "#e7e0d7",
  backgroundColor: "#faf6f0",
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
    channels,
    fetchChannels,
    addChannel,
    updateChannel,
    deleteChannel,
    apiAvailable,
  } = useTaskStore();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#8D7CF6");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelColor, setNewChannelColor] = useState("#4F46E5");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"json" | "csv" | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deletingDemo, setDeletingDemo] = useState(false);

  useEffect(() => {
    void fetchCalendarCategories();
    void fetchChannels();
  }, [fetchCalendarCategories, fetchChannels]);

  useEffect(() => {
    if (!deleteArmed) return;

    const timer = window.setTimeout(() => setDeleteArmed(false), 8000);
    return () => window.clearTimeout(timer);
  }, [deleteArmed]);

  if (!hydrated) {
    return (
      <section className="planning-board" style={boardStyle}>
        <div className="planning-toolbar">
          <span style={toolbarLabelStyle}>Einstellungen</span>
        </div>
        <div style={scrollStyle}>
          <div style={inner}>
            <div style={noteStyle}>
              <LoaderCircle size={14} className="animate-spin" />
              Einstellungen werden vorbereitet
            </div>
          </div>
        </div>
      </section>
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

  async function handleAddChannel(event: React.FormEvent) {
    event.preventDefault();

    const name = newChannelName.trim();
    if (!name) return;

    await addChannel({ name, color: newChannelColor });

    setNewChannelName("");
    setNewChannelColor("#4F46E5");
  }

  return (
    <section className="planning-board" style={boardStyle}>
      <div className="planning-toolbar">
        <span style={toolbarLabelStyle}>Einstellungen</span>
        <span style={toolbarDateStyle}>
          Zuletzt gespeichert {formatSavedAt(lastUpdatedAt)}
        </span>
      </div>

      <div style={scrollStyle}>
        <div style={inner}>
          <header style={headerStyle}>
            <div>
              <h1 style={titleStyle}>Einstellungen</h1>
              <p style={subtitleStyle}>
                Profil, Rituale, Workload, Fokus und Datenverwaltung an einem Ort.
                Alles wird lokal gespeichert und bleibt direkt beim Arbeiten spuerbar.
              </p>
            </div>
            <div style={pillsRow}>
              <span style={pillStyle}>{settings.display.themeMode} Theme</span>
              <span style={pillStyle}>
                {settings.display.timeFormat} · {settings.display.language.toUpperCase()}
              </span>
              <span style={pillStyle}>{celebrationLabel}</span>
            </div>
          </header>

          <div style={statsRow}>
            <StatTile
              label="Wochenkapazitaet"
              value={formatMinutes(totalWeeklyCapacity)}
              hint={`${formatMinutes(weekdayCapacity)} auf Werktage`}
            />
            <StatTile
              label="Planning"
              value={settings.planning.planningTime}
              hint="Start fuer deinen Morgen-Flow"
            />
            <StatTile
              label="Pomodoro"
              value={`${settings.focus.pomodoroMinutes}m`}
              hint="Default fuer Fokus-Sessions"
            />
            <StatTile
              label="Default-Event"
              value={`${settings.calendar.defaultEventDuration}m`}
              hint="Standard fuer Kalenderbloecke"
            />
          </div>

          <div style={grid2}>
            <Block icon={<User size={15} strokeWidth={1.9} />} title="Profil" hint="Identitaet & Kontakt">
              <div className="space-y-4">
                <div
                  className="flex items-center gap-4 rounded-[10px] border p-4"
                  style={cardSubtleStyle}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] text-[19px] font-semibold"
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
                      className="text-[14px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {settings.profile.name || "Dein Profil"}
                    </p>
                    <p
                      className="text-[12px] leading-5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Die Angaben werden lokal gehalten.
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
            </Block>

            <Block icon={<Sun size={15} strokeWidth={1.9} />} title="Display" hint="Theme, Sprache & Zeit">
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
            </Block>
          </div>

          <div style={grid2}>
            <Block icon={<CalendarDays size={15} strokeWidth={1.9} />} title="Planning" hint="Rituale & Rollover">
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
            </Block>

            <Block icon={<Target size={15} strokeWidth={1.9} />} title="Focus" hint="Pomodoro & Breaks">
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
            </Block>
          </div>

          <Block
            icon={<Clock3 size={15} strokeWidth={1.9} />}
            title="Workload"
            hint="Taegliche Kapazitaet pro Wochentag"
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

              <div className="rounded-[10px] border p-5" style={cardSubtleStyle}>
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
          </Block>

          <Block
            icon={<Bell size={15} strokeWidth={1.9} />}
            title="Signals"
            hint="Benachrichtigungen & Belohnung"
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
          </Block>

          <div style={grid2}>
            <Block icon={<Palette size={15} strokeWidth={1.9} />} title="Calendar" hint="Dauer & Farbpaletten">
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
                        className="h-[44px] w-full rounded-[8px] border bg-transparent p-1"
                        style={{
                          borderColor: "#e4ddd6",
                          backgroundColor: "#ffffff",
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px]"
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
                      className="flex items-center gap-3 rounded-[10px] border p-3"
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
                        className="h-10 w-10 shrink-0 rounded-[8px] border bg-transparent p-1"
                        style={{
                          borderColor: "#e4ddd6",
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
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150"
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
            </Block>

            <Block icon={<Hash size={15} strokeWidth={1.9} />} title="Channels" hint="Auto-Zuordnung">
              <div className="space-y-5">
                <p className="text-[12.5px] leading-6" style={{ color: "var(--text-muted)" }}>
                  Channels werden automatisch erkannt: Hat eine neue Task den Channel-Namen
                  im Titel (z.B. &quot;Mathe 2&quot; -&gt; Channel &quot;Mathe&quot;), wird
                  er beim Anlegen direkt gesetzt.
                </p>

                <form onSubmit={handleAddChannel} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_92px]">
                    <TextField
                      label="Neuer Channel"
                      value={newChannelName}
                      onChange={setNewChannelName}
                      placeholder="Mathe, Arbeit, Studium..."
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
                        value={newChannelColor}
                        onChange={(event) => setNewChannelColor(event.target.value)}
                        className="h-[44px] w-full rounded-[8px] border bg-transparent p-1"
                        style={{
                          borderColor: "#e4ddd6",
                          backgroundColor: "#ffffff",
                        }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px]"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      color: "white",
                    }}
                  >
                    <Hash size={13} />
                    Channel anlegen
                  </button>
                </form>

                <div className="space-y-3">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-3 rounded-[10px] border p-3"
                      style={cardSubtleStyle}
                    >
                      <input
                        type="color"
                        value={channel.color}
                        onChange={(event) =>
                          void updateChannel(channel.id, {
                            color: event.target.value,
                          })
                        }
                        className="h-10 w-10 shrink-0 rounded-[8px] border bg-transparent p-1"
                        style={{
                          borderColor: "#e4ddd6",
                        }}
                        aria-label={`Farbe fuer ${channel.name}`}
                      />
                      <input
                        value={channel.name}
                        onChange={(event) =>
                          void updateChannel(channel.id, {
                            name: event.target.value,
                          })
                        }
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none"
                        style={{ color: "var(--text-primary)" }}
                        aria-label="Channelname"
                      />
                      <button
                        type="button"
                        onClick={() => void deleteChannel(channel.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150"
                        style={{ color: "var(--text-muted)" }}
                        aria-label={`${channel.name} loeschen`}
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                  {channels.length === 0 && (
                    <p
                      className="text-[12.5px] leading-6"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Noch keine Channels. Lege deinen ersten an, um Tasks
                      automatisch zu kategorisieren.
                    </p>
                  )}
                </div>
              </div>
            </Block>
          </div>

          <Block
            icon={<Download size={15} strokeWidth={1.9} />}
            title="Data"
            hint="Export & Schutzschalter"
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

              <div className="rounded-[10px] border p-4" style={dangerCardStyle}>
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
                    className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-[12px] font-semibold transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-[12px] font-semibold"
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
          </Block>

          <Block
            icon={<CalendarDays size={15} strokeWidth={1.9} />}
            title="Integrations"
            hint="FocusPomo · Apple Kalender"
          >
            <FocusPomoSync />
          </Block>
        </div>
      </div>
    </section>
  );
}

function Block({
  icon,
  title,
  hint,
  children,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section style={block}>
      <header style={blockHeader}>
        <div style={blockHeading}>
          {icon && <span style={{ color: COLOR_MUTED, display: "inline-flex" }}>{icon}</span>}
          <h2 style={blockTitle}>{title}</h2>
        </div>
        {hint && <span style={blockHint}>{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article style={statTile}>
      <p style={statLabel}>{label}</p>
      <p style={statValue}>{value}</p>
      <p style={statHint}>{hint}</p>
    </article>
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
              ? "sm:min-w-[108px]"
              : "sm:min-w-[132px]";

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
      style={{ borderColor: "#efe8e0" }}
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
    <div className="border-b pb-4" style={{ borderColor: "#efe8e0" }}>
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
      className="rounded-[10px] border px-4 py-4 text-left transition-transform duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
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
      className="rounded-[8px] border px-4 py-3 text-[12.5px] leading-6"
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

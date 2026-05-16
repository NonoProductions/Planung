// =============================================================
// Sunsama Today – Scriptable Widget (Medium)
// Zeigt die heutigen, noch offenen Tasks im Stil der Webapp.
// =============================================================
//
// Setup:
//   1. Datei in den Scriptable iCloud-Ordner kopieren.
//   2. In CONFIG unten API_URL + TOKEN setzen (siehe README im Endpoint).
//      Backend braucht ENV: WIDGET_USER_ID + WIDGET_TOKEN.
//   3. Auf dem Homescreen ein "Scriptable" Medium-Widget hinzufügen,
//      Script auswählen.
//
// Solange API_URL leer ist, werden Beispiel-Tasks gezeigt.
// =============================================================

const CONFIG = {
  API_URL: "https://planung-ivory.vercel.app/api/widget/tasks",
  TOKEN:   "d859457329ae53f95fdc83fbe0f07e5e810522f089a683150d84234c434c5f98",
  LOCALE:  "de-DE",
  MAX_TASKS: 3,
};

// Farb-Palette ------------------------------------------------
const C = {
  bgGradient1:  new Color("#faf6f0"),
  bgGradient2:  new Color("#efe8de"),
  textPrimary:  new Color("#3d3832"),
  textSecond:   new Color("#7f786f"),
  textMuted:    new Color("#a8a097"),
  accent:       new Color("#8d7cf6"),
  accentLight:  new Color("#ece6ff"),
  border:       new Color("#d9d2c8"),
  success:      new Color("#57b679"),
  danger:       new Color("#e06f6f"),
};

// -------------------------------------------------------------
// Datenquelle
// -------------------------------------------------------------
function localDateString(d = new Date()) {
  // statt toISOString() (UTC) — sonst zeigt das Widget nachts den Vortag
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchTasks() {
  if (!CONFIG.API_URL) return { tasks: sampleTasks(), source: "sample" };

  const today = localDateString();
  const parts = [
    `date=${encodeURIComponent(today)}`,
    `t=${Date.now()}`, // Cache-Buster gegen CDN/Proxy
  ];
  if (CONFIG.TOKEN) parts.push(`token=${encodeURIComponent(CONFIG.TOKEN)}`);
  const url = `${CONFIG.API_URL}?${parts.join("&")}`;

  const req = new Request(url);
  req.method = "GET";
  req.timeoutInterval = 12;
  req.headers = { "Cache-Control": "no-cache", "Pragma": "no-cache" };

  try {
    const body = await req.loadString();
    const status = req.response?.statusCode ?? 0;
    if (status !== 200) {
      return {
        tasks: sampleTasks(),
        source: "error",
        error: `HTTP ${status}: ${body.slice(0, 120)}`,
      };
    }
    let data;
    try { data = JSON.parse(body); }
    catch (e) {
      return { tasks: sampleTasks(), source: "error", error: "JSON parse: " + e };
    }
    if (!Array.isArray(data)) {
      return { tasks: sampleTasks(), source: "error", error: "Antwort ist kein Array" };
    }
    return { tasks: data, source: "live" };
  } catch (e) {
    return { tasks: sampleTasks(), source: "error", error: String(e) };
  }
}

function sampleTasks() {
  return [
    { title: "Wochenplanung abschließen",   status: "OPEN",        plannedTime: 30, channel: { name: "Plan",    color: "#67b9ea" } },
    { title: "Design-Review Sunsama Clone", status: "OPEN",        plannedTime: 45, channel: { name: "Product", color: "#9d80f8" } },
    { title: "Newsletter Entwurf",          status: "IN_PROGRESS", plannedTime: 25, channel: { name: "Growth",  color: "#ffb54c" } },
    { title: "Team Sync vorbereiten",       status: "OPEN",        plannedTime: 15, channel: { name: "Plan",    color: "#67b9ea" } },
    { title: "Tagebuch schreiben",          status: "OPEN",        plannedTime: 10, channel: { name: "Personal",color: "#57b679" } },
  ];
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function formatDateHeader(date) {
  const df = new DateFormatter();
  df.locale = CONFIG.LOCALE;
  df.dateFormat = "EEEE, d. MMM";
  const s = df.string(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPlanned(min) {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

function formatDuration(min) {
  if (!min || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Match webapp logic: TaskList.tsx getDayProgress / getTaskCompletionRatio.
// Berücksichtigt actualTime (vom Kalender getrackt), sodass laufende Tasks
// schon Fortschritt erzeugen — nicht nur erledigte.
const DEFAULT_PROGRESS_WEIGHT_MINUTES = 30;

function taskWeight(task) {
  if (typeof task.plannedTime === "number" && task.plannedTime > 0) {
    return task.plannedTime;
  }
  return DEFAULT_PROGRESS_WEIGHT_MINUTES;
}

function taskCompletionRatio(task) {
  if (task.status === "COMPLETED") return 1;
  if (
    typeof task.plannedTime === "number" &&
    task.plannedTime > 0 &&
    typeof task.actualTime === "number" &&
    task.actualTime > 0
  ) {
    return Math.min(task.actualTime / task.plannedTime, 1);
  }
  return 0;
}

function computeDayProgress(tasks) {
  let weightedDone = 0;
  let totalWeight = 0;
  for (const t of tasks) {
    const w = taskWeight(t);
    weightedDone += w * taskCompletionRatio(t);
    totalWeight += w;
  }
  const remaining = Math.max(0, totalWeight - weightedDone);
  const progress = totalWeight > 0 ? weightedDone / totalWeight : 0;
  return {
    doneMin: Math.round(weightedDone),
    openMin: Math.round(remaining),
    totalMin: Math.round(totalWeight),
    progress,
  };
}

function safeColor(hex, fallback) {
  try { return new Color(hex); } catch { return fallback; }
}

// -------------------------------------------------------------
// Widget bauen
// -------------------------------------------------------------
async function buildWidget() {
  const { tasks, source, error } = await fetchTasks();
  const active = tasks.filter(t => t.status !== "ARCHIVED");
  const open = active.filter(t => t.status !== "COMPLETED");
  const shown = open.slice(0, CONFIG.MAX_TASKS);
  const remaining = Math.max(0, open.length - shown.length);

  const { doneMin, openMin, progress } = computeDayProgress(active);

  const w = new ListWidget();
  // iOS soll möglichst alle 5 Min neu laden statt die Default-Heuristik
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  const g = new LinearGradient();
  g.colors = [C.bgGradient1, C.bgGradient2];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(9, 14, 8, 14);

  // Header --------------------------------------------------
  const header = w.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const titleStack = header.addStack();
  titleStack.layoutVertically();

  const title = titleStack.addText("Heute");
  title.font = Font.boldRoundedSystemFont(15);
  title.textColor = C.textPrimary;

  const subtitle = titleStack.addText(formatDateHeader(new Date()));
  subtitle.font = Font.systemFont(10);
  subtitle.textColor = C.textSecond;

  header.addSpacer();

  // Chip mit offener Anzahl
  const chip = header.addStack();
  chip.backgroundColor = C.accentLight;
  chip.cornerRadius = 9;
  chip.setPadding(3, 8, 3, 8);
  chip.centerAlignContent();

  const chipLabel = chip.addText(`${open.length} offen`);
  chipLabel.font = Font.semiboldRoundedSystemFont(10);
  chipLabel.textColor = C.accent;

  w.addSpacer(7);

  // Fortschritt ---------------------------------------------
  const progRow = w.addStack();
  progRow.layoutHorizontally();
  progRow.centerAlignContent();

  const doneText = progRow.addText(formatDuration(doneMin));
  doneText.font = Font.semiboldRoundedSystemFont(10);
  doneText.textColor = C.success;

  const sep1 = progRow.addText(" geschafft");
  sep1.font = Font.systemFont(9);
  sep1.textColor = C.textSecond;

  progRow.addSpacer();

  const pct = progRow.addText(`${Math.round(progress * 100)}%`);
  pct.font = Font.semiboldRoundedSystemFont(10);
  pct.textColor = C.textPrimary;

  progRow.addSpacer();

  const leftLabel = progRow.addText("noch ");
  leftLabel.font = Font.systemFont(9);
  leftLabel.textColor = C.textSecond;

  const leftText = progRow.addText(formatDuration(openMin));
  leftText.font = Font.semiboldRoundedSystemFont(10);
  leftText.textColor = C.accent;

  w.addSpacer(3);

  const barWrap = w.addStack();
  barWrap.layoutHorizontally();
  const bar = barWrap.addImage(progressBarImage(progress));
  bar.resizable = true;
  bar.imageSize = new Size(300, 5);

  w.addSpacer(7);

  // Task-Liste ----------------------------------------------
  if (shown.length === 0) {
    w.addSpacer();
    const t = w.addText("Alles erledigt für heute ✨");
    t.font = Font.mediumRoundedSystemFont(13);
    t.textColor = C.textSecond;
    t.centerAlignText();
    w.addSpacer();
  } else {
    for (let i = 0; i < shown.length; i++) {
      addTaskRow(w, shown[i]);
      if (i < shown.length - 1) w.addSpacer(5);
    }
  }

  w.addSpacer();

  // Footer --------------------------------------------------
  const footer = w.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  if (source === "error") {
    const errText = footer.addText("⚠︎ " + (error || "Fetch fehlgeschlagen").slice(0, 60));
    errText.font = Font.systemFont(9);
    errText.textColor = C.danger;
    errText.lineLimit = 1;
  } else if (source === "sample") {
    const t = footer.addText("Beispiel-Daten");
    t.font = Font.systemFont(9);
    t.textColor = C.textMuted;
  } else {
    const t = footer.addText("Aktualisiert");
    t.font = Font.systemFont(9);
    t.textColor = C.textMuted;
    footer.addSpacer(4);
    const time = footer.addDate(new Date());
    time.applyTimeStyle();
    time.font = Font.systemFont(9);
    time.textColor = C.textMuted;
  }

  footer.addSpacer();

  if (remaining > 0) {
    const more = footer.addText(`+${remaining} weitere`);
    more.font = Font.semiboldRoundedSystemFont(10);
    more.textColor = C.accent;
  }

  return w;
}

function addTaskRow(parent, task) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;

  // Farbiger Streifen links (Channel)
  const channelColor = task.channel?.color
    ? safeColor(task.channel.color, C.accent)
    : C.border;
  const bar = row.addImage(roundedBarImage(channelColor));
  bar.imageSize = new Size(3, 14);

  // Checkbox / Status-Punkt
  const inProgress = task.status === "IN_PROGRESS";
  const cbColor = inProgress ? C.accent : C.textMuted;
  const checkbox = row.addImage(circleImage(cbColor, inProgress));
  checkbox.imageSize = new Size(10, 10);

  // Titel
  const titleText = row.addText(task.title || "Ohne Titel");
  titleText.font = Font.regularRoundedSystemFont(12);
  titleText.textColor = C.textPrimary;
  titleText.lineLimit = 1;
  titleText.minimumScaleFactor = 0.75;

  row.addSpacer();

  // Geplante Zeit als Pill
  const planned = formatPlanned(task.plannedTime);
  if (planned) {
    const pill = row.addStack();
    pill.backgroundColor = new Color("#ffffff", 0.55);
    pill.cornerRadius = 6;
    pill.setPadding(2, 6, 2, 6);
    const t = pill.addText(planned);
    t.font = Font.mediumRoundedSystemFont(10);
    t.textColor = C.textSecond;
  }
}

// -------------------------------------------------------------
// Bild-Helfer
// -------------------------------------------------------------
function circleImage(color, filled) {
  const size = 44; // hohe Auflösung, wird per imageSize verkleinert
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const inset = 4;
  const rect = new Rect(inset, inset, size - inset * 2, size - inset * 2);
  if (filled) {
    ctx.setFillColor(color);
    ctx.fillEllipse(rect);
  } else {
    ctx.setStrokeColor(color);
    ctx.setLineWidth(3);
    ctx.strokeEllipse(rect);
  }
  return ctx.getImage();
}

function progressBarImage(progress) {
  const w = 600;
  const h = 12;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  ctx.setFillColor(C.border);
  const bgPath = new Path();
  bgPath.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  ctx.addPath(bgPath);
  ctx.fillPath();

  const p = Math.max(0, Math.min(1, progress));
  if (p > 0) {
    const fillW = Math.max(h, w * p);
    ctx.setFillColor(C.success);
    const fgPath = new Path();
    fgPath.addRoundedRect(new Rect(0, 0, fillW, h), h / 2, h / 2);
    ctx.addPath(fgPath);
    ctx.fillPath();
  }
  return ctx.getImage();
}

function roundedBarImage(color) {
  const w = 12;
  const h = 72;
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(color);
  const path = new Path();
  path.addRoundedRect(new Rect(0, 0, w, h), w / 2, w / 2);
  ctx.addPath(path);
  ctx.fillPath();
  return ctx.getImage();
}

// -------------------------------------------------------------
// Run
// -------------------------------------------------------------
const widget = await buildWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();

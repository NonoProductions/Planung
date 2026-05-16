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
  // Im LAN: http://<deine-LAN-IP>:3000/api/widget/tasks  (PC + iPhone im gleichen WLAN)
  // Deployed: https://deine-domain/api/widget/tasks
  API_URL: "https://planung-ivory.vercel.app/api/widget/tasks",
  // muss exakt mit env WIDGET_TOKEN im Backend übereinstimmen
  TOKEN:   "d859457329ae53f95fdc83fbe0f07e5e810522f089a683150d84234c434c5f98",
  LOCALE:  "de-DE",
  MAX_TASKS: 5,
};

// Farb-Palette aus globals.css ---------------------------------
const C = {
  bgPrimary:    new Color("#f4efe8"),
  bgGradient1:  new Color("#f8f4ee"),
  bgGradient2:  new Color("#f1ebe3"),
  bgCard:       new Color("#ffffff"),
  textPrimary:  new Color("#4c463f"),
  textSecond:   new Color("#7f786f"),
  textMuted:    new Color("#b2aaa1"),
  accent:       new Color("#8d7cf6"),
  accentLight:  new Color("#f0ebff"),
  border:       new Color("#e6dfd7"),
  success:      new Color("#57b679"),
  warning:      new Color("#f4ad46"),
  danger:       new Color("#e06f6f"),
};

// -------------------------------------------------------------
// Datenquelle
// -------------------------------------------------------------
async function fetchTasks() {
  if (!CONFIG.API_URL) return { tasks: sampleTasks(), source: "sample" };

  const today = new Date().toISOString().slice(0, 10);
  const parts = [`date=${encodeURIComponent(today)}`];
  if (CONFIG.TOKEN) parts.push(`token=${encodeURIComponent(CONFIG.TOKEN)}`);
  const url = `${CONFIG.API_URL}?${parts.join("&")}`;

  const req = new Request(url);
  req.method = "GET";
  req.timeoutInterval = 12;

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
    { title: "Gym 💪",                       status: "COMPLETED",   plannedTime: 60, channel: { name: "Personal",color: "#57b679" } },
    { title: "Tagebuch schreiben",          status: "OPEN",        plannedTime: 10, channel: { name: "Personal",color: "#57b679" } },
  ];
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function formatDateHeader(date) {
  const df = new DateFormatter();
  df.locale = CONFIG.LOCALE;
  df.dateFormat = "EEEE, d. MMMM";
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

function safeColor(hex, fallback) {
  try { return new Color(hex); } catch { return fallback; }
}

// -------------------------------------------------------------
// Widget bauen
// -------------------------------------------------------------
async function buildWidget() {
  const { tasks, source, error } = await fetchTasks();
  const open = tasks.filter(t => t.status !== "COMPLETED" && t.status !== "ARCHIVED");
  const shown = open.slice(0, CONFIG.MAX_TASKS);
  const remaining = Math.max(0, open.length - shown.length);

  const w = new ListWidget();
  w.backgroundGradient = (() => {
    const g = new LinearGradient();
    g.colors = [C.bgGradient1, C.bgGradient2];
    g.locations = [0, 1];
    return g;
  })();
  w.setPadding(14, 14, 14, 14);

  // Karte
  const card = w.addStack();
  card.layoutVertically();
  card.backgroundColor = C.bgCard;
  card.cornerRadius = 16;
  card.setPadding(12, 14, 12, 14);
  card.size = new Size(0, 0);

  // Header --------------------------------------------------
  const header = card.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const titleStack = header.addStack();
  titleStack.layoutVertically();

  const title = titleStack.addText("Heute");
  title.font = Font.semiboldRoundedSystemFont(15);
  title.textColor = C.textPrimary;

  const subtitle = titleStack.addText(formatDateHeader(new Date()));
  subtitle.font = Font.systemFont(10);
  subtitle.textColor = C.textSecond;

  header.addSpacer();

  // Chip mit offener Anzahl
  const chip = header.addStack();
  chip.backgroundColor = C.accentLight;
  chip.cornerRadius = 999;
  chip.setPadding(4, 9, 4, 9);
  chip.centerAlignContent();

  const dot = chip.addText("●");
  dot.font = Font.systemFont(7);
  dot.textColor = C.accent;
  chip.addSpacer(4);

  const chipLabel = chip.addText(`${open.length} offen`);
  chipLabel.font = Font.mediumRoundedSystemFont(10);
  chipLabel.textColor = C.accent;

  card.addSpacer(8);
  drawDivider(card);
  card.addSpacer(6);

  // Task-Liste ----------------------------------------------
  if (shown.length === 0) {
    const empty = card.addStack();
    empty.layoutVertically();
    empty.addSpacer();
    const t = empty.addText("Alles erledigt für heute ✨");
    t.font = Font.mediumRoundedSystemFont(13);
    t.textColor = C.textSecond;
    t.centerAlignText();
    empty.addSpacer();
  } else {
    for (let i = 0; i < shown.length; i++) {
      addTaskRow(card, shown[i]);
      if (i < shown.length - 1) card.addSpacer(4);
    }
  }

  card.addSpacer();

  // Footer --------------------------------------------------
  const footer = card.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  if (source === "error") {
    const errIcon = footer.addText("⚠︎ ");
    errIcon.font = Font.mediumRoundedSystemFont(10);
    errIcon.textColor = C.danger;
    const errText = footer.addText((error || "Fetch fehlgeschlagen").slice(0, 80));
    errText.font = Font.systemFont(9);
    errText.textColor = C.danger;
    errText.lineLimit = 2;
  } else if (source === "sample") {
    const t = footer.addText("Beispiel-Daten – API_URL setzen");
    t.font = Font.systemFont(9);
    t.textColor = C.textMuted;
  }

  footer.addSpacer();

  if (remaining > 0) {
    const more = footer.addText(`+${remaining} weitere`);
    more.font = Font.mediumRoundedSystemFont(10);
    more.textColor = C.textMuted;
  }

  return w;
}

function addTaskRow(parent, task) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;

  // Checkbox-Kreis
  const cbColor = task.status === "IN_PROGRESS" ? C.accent : C.border;
  const checkbox = row.addImage(circleImage(cbColor, task.status === "IN_PROGRESS"));
  checkbox.imageSize = new Size(14, 14);

  // Titel
  const titleText = row.addText(task.title || "Ohne Titel");
  titleText.font = Font.regularRoundedSystemFont(12);
  titleText.textColor = C.textPrimary;
  titleText.lineLimit = 1;
  titleText.minimumScaleFactor = 0.85;

  row.addSpacer();

  // Channel-Punkt
  if (task.channel?.color) {
    const dot = row.addImage(circleImage(safeColor(task.channel.color, C.accent), true));
    dot.imageSize = new Size(8, 8);
  }

  // Geplante Zeit
  const planned = formatPlanned(task.plannedTime);
  if (planned) {
    row.addSpacer(4);
    const t = row.addText(planned);
    t.font = Font.mediumRoundedSystemFont(10);
    t.textColor = C.textMuted;
  }
}

function drawDivider(parent) {
  const ctx = new DrawContext();
  ctx.size = new Size(600, 1);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(C.border);
  ctx.fillRect(new Rect(0, 0, 600, 1));
  const img = parent.addImage(ctx.getImage());
  img.resizable = true;
  img.imageSize = new Size(600, 1);
}

function circleImage(color, filled) {
  const size = 28;
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const rect = new Rect(1, 1, size - 2, size - 2);
  if (filled) {
    ctx.setFillColor(color);
    ctx.fillEllipse(rect);
  } else {
    ctx.setStrokeColor(color);
    ctx.setLineWidth(2);
    ctx.strokeEllipse(rect);
  }
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

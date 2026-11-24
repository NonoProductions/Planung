// Reads the lectures ("(V)" events) from the Apple calendar "Vorlesung" on this Mac and saves
// them for one account. Ticked-off lectures and comments survive a re-import.
// Usage: node --env-file=.env.local scripts/import-lectures.mjs <e-mail> [--dry-run]
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!email) throw new Error("E-Mail des Kontos fehlt");

const JXA = `
  const events = Application("Calendar").calendars.byName("Vorlesung").events;
  const out = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    out.push({
      title: e.summary(),
      start: e.startDate().getTime(),
      end: e.endDate().getTime(),
      rule: e.recurrence() || "",
      excluded: (e.excludedDates() || []).map((d) => d.getTime()),
    });
  }
  JSON.stringify(out);
`;
const events = JSON.parse(execFileSync("osascript", ["-l", "JavaScript", "-e", JXA], { encoding: "utf8" }));

const pad = (n) => String(n).padStart(2, "0");
const local = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseUntil(value) {
  const m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)Z)?$/.exec(value ?? "");
  if (!m) return null;
  return m[4] ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) : new Date(m[1], m[2] - 1, m[3], 23, 59).getTime();
}

function occurrences(event) {
  if (!event.rule) return [new Date(event.start)];
  const rule = Object.fromEntries(event.rule.split(";").map((part) => part.split("=")));
  if (rule.FREQ !== "WEEKLY" || (rule.BYDAY ?? "").includes(",")) {
    throw new Error(`Wiederholung nicht unterstützt: ${event.rule} (${event.title})`);
  }
  const until = parseUntil(rule.UNTIL) ?? event.start + 183 * 86_400_000;
  const excludedDays = new Set(event.excluded.map((t) => local(new Date(t)).slice(0, 10)));
  const result = [];
  const cursor = new Date(event.start);
  for (let n = 0; cursor.getTime() <= until && n < Number(rule.COUNT ?? 200); n++) {
    if (!excludedDays.has(local(cursor).slice(0, 10))) result.push(new Date(cursor));
    // Calendar days, so the local time survives the daylight saving switch.
    cursor.setDate(cursor.getDate() + 7 * Number(rule.INTERVAL ?? 1));
  }
  return result;
}

const subjects = new Map();
for (const event of events) {
  const match = /^(\S+) - (.+) \(V\)(?:, ([^,]+))?/.exec(event.title);
  if (!match) continue; // Übungen, Tutorien …
  const [, id, fullName, lecturer] = match;
  if (!subjects.has(id)) {
    const name = fullName.split(" / ")[0].split(" für die ")[0].trim();
    subjects.set(id, { id, name, lecturer: lecturer?.trim() ?? "", sessions: new Map() });
  }
  for (const start of occurrences(event)) {
    // The same lecture in two rooms counts once.
    subjects.get(id).sessions.set(local(start), local(new Date(start.getTime() + event.end - event.start)));
  }
}

const schedule = {
  subjects: [...subjects.values()]
    .map(({ sessions, ...subject }) => ({
      ...subject,
      sessions: [...sessions].sort().map(([start, end]) => ({ start, end })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de")),
};
if (schedule.subjects.length === 0) throw new Error("Keine Vorlesungen gefunden, nichts geändert");

for (const s of schedule.subjects) {
  console.log(`${s.name} (${s.lecturer}): ${s.sessions.length}, ${s.sessions[0].start} – ${s.sessions.at(-1).start}`);
}
if (dryRun) {
  console.log(JSON.stringify(schedule.subjects.map((s) => [s.name, s.sessions.map((x) => x.start)]), null, 1));
  process.exit();
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user, error: userError } = await supabase
  .from("User")
  .select("id, settings")
  .ilike("email", email)
  .single();
if (userError) throw userError;

const previous = user.settings?.lectures;
let update = supabase
  .from("User")
  .update({
    settings: {
      ...user.settings,
      lectures: {
        marks: {},
        ...previous, // ticks, comments, exams, planned tasks
        ...schedule,
        rev: crypto.randomUUID(),
      },
    },
  })
  .eq("id", user.id);
update = previous
  ? update.eq("settings->lectures->>rev", previous.rev)
  : update.is("settings->lectures", null);
const { data: saved, error } = await update.select("id");
if (error) throw error;
if (saved.length === 0) throw new Error("Gleichzeitig wurde etwas abgehakt, bitte noch einmal ausführen");
console.log("Gespeichert.");

import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/server-auth";
import { supabase } from "@/lib/supabase";
import type { LectureMark, LectureSubject } from "@/types";

// Stored in User.settings.lectures. The timetable is written by scripts/import-lectures.mjs.
interface LectureData {
  /** Changes with every write, so two writes at once cannot overwrite each other. */
  rev: string;
  subjects: LectureSubject[];
  marks: Record<string, LectureMark>;
  /** Comments, e.g. how far a half-finished lecture got. */
  notes?: Record<string, string>;
  /** Exam day per subject ID. */
  exams?: Record<string, string>;
  /** Task created to work through a lecture; ticking one ticks the other. */
  tasks?: Record<string, string>;
}

type UserSettings = Record<string, unknown> & { lectures?: LectureData };

const MAX_ATTEMPTS = 6;
const KEY_PATTERN = /^[^|]{1,40}\|\d{4}-\d\d-\d\dT\d\d:\d\d$/;
const DAY_PATTERN = /^20\d\d-\d\d-\d\d$/;
const MAX_NOTE_LENGTH = 1000;

async function readSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("User")
    .select("settings")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data.settings ?? {}) as UserSettings;
}

function unavailable() {
  return Response.json({ error: "Database unavailable" }, { status: 503 });
}

/**
 * Applies `change` to the newest state and saves it, again if another device wrote in between.
 * `change` returns null when there is nothing to save. Resolves null if the user has no lectures.
 */
async function updateLectures(
  userId: string,
  change: (lectures: LectureData) => Promise<LectureData | null>
): Promise<LectureData | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const settings = await readSettings(userId);
    const { lectures } = settings;
    if (!lectures) return null;

    const changed = await change(lectures);
    if (!changed) return lectures;

    const { data, error } = await supabase
      .from("User")
      .update({
        settings: { ...settings, lectures: { ...changed, rev: crypto.randomUUID() } },
      })
      .eq("id", userId)
      .eq("settings->lectures->>rev", lectures.rev)
      .select("id");
    if (error) throw error;
    if (data.length > 0) return changed;
  }
  throw new Error("Too many concurrent writes");
}

async function readLinkedTasks(userId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { status: string; date: string | null }>();
  const { data, error } = await supabase
    .from("Task")
    .select("id, status, scheduledDate")
    .eq("userId", userId)
    .in("id", ids);
  if (error) throw error;
  return new Map(
    data.map((task) => [
      task.id as string,
      {
        status: task.status as string,
        date: task.scheduledDate ? String(task.scheduledDate).slice(0, 10) : null,
      },
    ])
  );
}

// GET /api/lectures
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let linked: Awaited<ReturnType<typeof readLinkedTasks>> = new Map();

    // Take over what happened to the planned tasks elsewhere in the app.
    const lectures = await updateLectures(userId, async (current) => {
      linked = await readLinkedTasks(userId, Object.values(current.tasks ?? {}));
      const marks = { ...current.marks };
      const tasks = { ...current.tasks };
      let changed = false;
      for (const [key, id] of Object.entries(tasks)) {
        const task = linked.get(id);
        if (!task) {
          delete tasks[key];
          changed = true;
        } else if (task.status === "COMPLETED") {
          if (marks[key] !== "done" && marks[key] !== "cancelled") {
            marks[key] = "done";
            changed = true;
          }
        } else if (task.status !== "ARCHIVED" && marks[key] === "done") {
          delete marks[key];
          changed = true;
        }
      }
      return changed ? { ...current, marks, tasks } : null;
    });

    return Response.json({
      subjects: lectures?.subjects ?? [],
      marks: lectures?.marks ?? {},
      notes: lectures?.notes ?? {},
      exams: lectures?.exams ?? {},
      plans: Object.fromEntries(
        Object.entries(lectures?.tasks ?? {}).map(([key, id]) => [key, linked.get(id)?.date ?? ""])
      ),
    });
  } catch {
    return unavailable();
  }
}

// PATCH /api/lectures, one of:
// { keys: ["<subjectId>|YYYY-MM-DDTHH:mm"], status: "done" | "started" | "cancelled" | null }
// { keys, note: "text" }           sets a comment (empty text removes it)
// { keys: [key], plan: "YYYY-MM-DD" }  creates a task for that day, or moves the existing one
// { subjectId, exam: "YYYY-MM-DD" | null }
export async function PATCH(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const invalid = () => Response.json({ error: "Invalid body" }, { status: 400 });
  if (!body) return invalid();

  try {
    let result: LectureData | null;

    if (body.exam !== undefined) {
      const { subjectId, exam } = body;
      if (typeof subjectId !== "string" || subjectId.length > 40) return invalid();
      if (exam !== null && !(typeof exam === "string" && DAY_PATTERN.test(exam))) return invalid();

      result = await updateLectures(userId, async (lectures) => {
        const exams = { ...lectures.exams };
        if (exam) exams[subjectId] = exam as string;
        else delete exams[subjectId];
        return { ...lectures, exams };
      });
    } else {
      if (!Array.isArray(body.keys) || body.keys.length === 0 || body.keys.length > 200) {
        return invalid();
      }
      if (!body.keys.every((key) => typeof key === "string" && KEY_PATTERN.test(key))) {
        return invalid();
      }
      const keys = body.keys as string[];
      const { note, plan, status } = body;

      if (note !== undefined) {
        if (typeof note !== "string" || note.length > MAX_NOTE_LENGTH) return invalid();
        result = await updateLectures(userId, async (lectures) => {
          const notes = { ...lectures.notes };
          for (const key of keys) {
            if (note.trim()) notes[key] = note.trim();
            else delete notes[key];
          }
          return { ...lectures, notes };
        });
      } else if (plan !== undefined) {
        if (typeof plan !== "string" || !DAY_PATTERN.test(plan) || keys.length !== 1) {
          return invalid();
        }
        result = await planLecture(userId, keys[0], plan);
      } else {
        if (!["done", "started", "cancelled", null].includes(status as string | null)) {
          return invalid();
        }
        result = await updateLectures(userId, async (lectures) => {
          const marks = { ...lectures.marks };
          for (const key of keys) {
            if (status) marks[key] = status as LectureMark;
            else delete marks[key];
          }
          if (status !== "cancelled") {
            const ids = keys.map((key) => lectures.tasks?.[key]).filter(Boolean) as string[];
            await setTasksCompleted(userId, ids, status === "done");
          }
          return { ...lectures, marks };
        });
      }
    }

    if (!result) return Response.json({ error: "No lectures" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return unavailable();
  }
}

async function setTasksCompleted(userId: string, ids: string[], completed: boolean) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const update = supabase
    .from("Task")
    .update({
      status: completed ? "COMPLETED" : "OPEN",
      completedAt: completed ? now : null,
      updatedAt: now,
    })
    .eq("userId", userId)
    .in("id", ids);
  const { error } = await (completed
    ? update.neq("status", "COMPLETED")
    : update.eq("status", "COMPLETED"));
  if (error) throw error;
}

async function planLecture(userId: string, key: string, day: string) {
  const newId = crypto.randomUUID();
  const scheduledDate = new Date(day).toISOString();
  const updatedAt = new Date().toISOString();

  const result = await updateLectures(userId, async (lectures) => {
    const existing = lectures.tasks?.[key];
    if (existing) {
      const { data, error } = await supabase
        .from("Task")
        .update({
          scheduledDate,
          scheduledStart: null,
          scheduledEnd: null,
          isBacklog: false,
          updatedAt,
        })
        .eq("userId", userId)
        .eq("id", existing)
        .select("id");
      if (error) throw error;
      if (data.length > 0) return null;
    }
    return { ...lectures, tasks: { ...lectures.tasks, [key]: newId } };
  });
  if (result?.tasks?.[key] !== newId) return result;

  // Linked first: if creating the task fails, the next GET drops the dangling link.
  const [subjectId, start] = key.split("|");
  const subject = result.subjects.find((item) => item.id === subjectId);
  const number = (subject?.sessions.findIndex((session) => session.start === start) ?? -1) + 1;
  const { data: last, error: positionError } = await supabase
    .from("Task")
    .select("position")
    .eq("userId", userId)
    .is("parentId", null)
    .eq("scheduledDate", scheduledDate)
    .order("position", { ascending: false })
    .limit(1);
  if (positionError) throw positionError;

  const { error } = await supabase.from("Task").insert({
    id: newId,
    title: `${subject?.name ?? "Vorlesung"}: Vorlesung ${number || ""} nacharbeiten`.replace("  ", " "),
    status: "OPEN",
    scheduledDate,
    position: last.length > 0 ? last[0].position + 1 : 0,
    isRecurring: false,
    isBacklog: false,
    userId,
    updatedAt,
  });
  if (error) throw error;
  return result;
}

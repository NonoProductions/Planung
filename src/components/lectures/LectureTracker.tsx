"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Check, ChevronLeft, Ellipsis } from "lucide-react";
import { toLocalDateString } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import type { LectureMark, LectureSession, LectureSubject } from "@/types";

type Marks = Record<string, LectureMark>;
type Notes = Record<string, string>;
/** Day of the task planned for a lecture; empty if the task has no day. */
type Plans = Record<string, string>;
type Exams = Record<string, string>;
type Panel = { key: string; kind: "note" | "plan" | "menu" };

function markKey(subject: LectureSubject, session: LectureSession) {
  return `${subject.id}|${session.start}`;
}

/** Held lectures count; cancelled ones never do. */
function progressOf(subject: LectureSubject, marks: Marks, now: Date) {
  const held = subject.sessions.filter(
    (session) =>
      new Date(session.end) <= now && marks[markKey(subject, session)] !== "cancelled"
  );
  const count = (mark: LectureMark) =>
    held.filter((session) => marks[markKey(subject, session)] === mark).length;
  const done = count("done");
  const started = count("started");
  return {
    held: held.length,
    done,
    started,
    open: held.length - done,
    /** Started lectures count half. */
    share: held.length > 0 ? (done + started / 2) / held.length : 0,
  };
}

/** Held but unfinished lectures, the started ones first. */
function openSessionsOf(subject: LectureSubject, marks: Marks, now: Date) {
  const unfinished = subject.sessions.filter((session) => {
    const mark = marks[markKey(subject, session)];
    return new Date(session.end) <= now && (!mark || mark === "started");
  });
  const isStarted = (session: LectureSession) => marks[markKey(subject, session)] === "started";
  return [
    ...unfinished.filter(isStarted),
    ...unfinished.filter((session) => !isStarted(session)),
  ];
}

function examLabel(exam: string | undefined, now: Date) {
  if (!exam) return null;
  const days = differenceInCalendarDays(parseISO(exam), now);
  if (days < 0) return "Klausur vorbei";
  if (days === 0) return "Klausur heute";
  return days === 1 ? "Klausur morgen" : `Klausur in ${days} Tagen`;
}

function formatDate(day: string) {
  return format(parseISO(day), "EEEEEE, d. MMM", { locale: de });
}

function formatDay(session: LectureSession) {
  return format(new Date(session.start), "EEEEEE, d. MMM", { locale: de });
}

function formatTime(session: LectureSession) {
  return session.start.slice(11);
}

export default function LectureTracker() {
  const subjectId = useSearchParams().get("fach");
  const [subjects, setSubjects] = useState<LectureSubject[] | null>(null);
  const [marks, setMarks] = useState<Marks>({});
  const [notes, setNotes] = useState<Notes>({});
  const [plans, setPlans] = useState<Plans>({});
  const [exams, setExams] = useState<Exams>({});
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // Saves run one after another; a reload must not overwrite ticks still being saved.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const failedSave = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/lectures");
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        subjects: LectureSubject[];
        marks: Marks;
        notes: Notes;
        plans: Plans;
        exams: Exams;
      };
      if (pending.current > 0) return;
      setSubjects(data.subjects);
      setMarks(data.marks);
      setNotes(data.notes);
      setPlans(data.plans);
      setExams(data.exams);
      setNow(new Date());
      setError(null);
    } catch {
      setError("Vorlesungen konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    void load();
    const handleVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [load]);

  const save = (body: object): Promise<boolean> => {
    pending.current += 1;
    const result = queue.current.then(async () => {
      let ok = false;
      try {
        const response = await fetch("/api/lectures", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        ok = response.ok;
      } catch {
        // Handled below like any other failed save.
      }
      pending.current -= 1;
      if (!ok) failedSave.current = true;
      if (pending.current === 0 && failedSave.current) {
        failedSave.current = false;
        // Show what is really stored instead of a tick that was never saved.
        await load();
        setError("Nicht gespeichert. Bitte noch einmal versuchen.");
      }
      return ok;
    });
    queue.current = result.then(() => undefined);
    return result;
  };

  const applyMark = (keys: string[], status: LectureMark | null) => {
    if (keys.length === 0) return;
    haptic("select");
    setError(null);
    setMarks((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (status) next[key] = status;
        else delete next[key];
      }
      return next;
    });
    void save({ keys, status });
  };

  /** Resolves false when saving failed, so the editor can keep the text. */
  const saveNote = async (key: string, note: string) => {
    setError(null);
    const ok = await save({ keys: [key], note });
    if (ok) {
      setNotes((current) => {
        const next = { ...current };
        if (note.trim()) next[key] = note.trim();
        else delete next[key];
        return next;
      });
    }
    return ok;
  };

  const planTask = (key: string, day: string) => {
    haptic("select");
    setError(null);
    setPlans((current) => ({ ...current, [key]: day }));
    void save({ keys: [key], plan: day });
  };

  const saveExam = (id: string, exam: string | null) => {
    setError(null);
    setExams((current) => {
      const next = { ...current };
      if (exam) next[id] = exam;
      else delete next[id];
      return next;
    });
    void save({ subjectId: id, exam });
  };

  // Next exam first; subjects without an upcoming exam keep their order behind them.
  const today = toLocalDateString(now);
  const examRank = (item: LectureSubject) =>
    exams[item.id] && exams[item.id] >= today ? exams[item.id] : "9";
  const sortedSubjects = [...(subjects ?? [])].sort((a, b) =>
    examRank(a).localeCompare(examRank(b))
  );

  const subject = subjects?.find((item) => item.id === subjectId);
  const totalOpen = (subjects ?? []).reduce(
    (sum, item) => sum + progressOf(item, marks, now).open,
    0
  );
  const openCount = subject ? progressOf(subject, marks, now).open : totalOpen;

  return (
    <section className="planning-board lecture-tracker">
      <div className="planning-toolbar backlog-toolbar">
        <div className="backlog-toolbar__title">
          {subject && (
            <Link href="/vorlesungen" className="planning-toolbar__button">
              <ChevronLeft size={15} strokeWidth={2.2} />
              Fächer
            </Link>
          )}
          <span className="settings-toolbar__title lecture-toolbar__name">
            {subject ? subject.name : "Vorlesungen"}
          </span>
          {subjects && subjects.length > 0 && (
            <span
              className={`planning-card__duration ${openCount > 0 ? "lecture-chip--open" : "lecture-chip--done"}`}
            >
              {openCount > 0 ? `${openCount} offen` : "aufgeholt"}
            </span>
          )}
        </div>
        {subject && (
          <label className="lecture-exam">
            <span>{examLabel(exams[subject.id], now) ?? "Klausur"}</span>
            <input
              key={`${subject.id}-${exams[subject.id] ?? ""}`}
              type="date"
              className="planning-toolbar__button"
              aria-label="Klausurtermin"
              defaultValue={exams[subject.id] ?? ""}
              onBlur={(event) => {
                const value = event.target.value;
                if (value === (exams[subject.id] ?? "")) return;
                // Incomplete years (e.g. 0002) come up while typing.
                if (value === "" || /^20\d\d-/.test(value)) saveExam(subject.id, value || null);
              }}
              onChange={(event) => {
                // Picked or fully typed; clearing waits for blur, as editing passes through empty.
                const value = event.target.value;
                if (/^20\d\d-/.test(value)) saveExam(subject.id, value);
              }}
            />
          </label>
        )}
        {error && (
          <p className="lecture-error" role="alert">
            {error}
            {!subjects && (
              <button type="button" onClick={() => void load()}>
                Erneut versuchen
              </button>
            )}
          </p>
        )}
      </div>

      <div className="planning-columns">
        {!subjects && !error && (
          <p className="backlog-empty-copy lecture-empty">Wird geladen...</p>
        )}
        {subjects?.length === 0 && (
          <p className="backlog-empty-copy lecture-empty">
            Noch keine Vorlesungen aus dem Apple Kalender übernommen.
          </p>
        )}
        {subject ? (
          <SubjectDetail
            subject={subject}
            marks={marks}
            notes={notes}
            plans={plans}
            now={now}
            onMark={applyMark}
            onPlan={planTask}
            onNote={saveNote}
          />
        ) : (
          subjects && (
            <div className="lecture-overview">
              {sortedSubjects.map((item) => (
                <SubjectTile
                  key={item.id}
                  subject={item}
                  marks={marks}
                  notes={notes}
                  exam={exams[item.id]}
                  now={now}
                />
              ))}
            </div>
          )
        )}
      </div>
    </section>
  );
}

function SubjectTile({
  subject,
  marks,
  notes,
  exam,
  now,
}: {
  subject: LectureSubject;
  marks: Marks;
  notes: Notes;
  exam?: string;
  now: Date;
}) {
  const { held, done, started, open, share } = progressOf(subject, marks, now);
  const next = openSessionsOf(subject, marks, now)[0];
  const nextNote = next && notes[markKey(subject, next)];
  const examText = examLabel(exam, now);

  return (
    <Link href={`/vorlesungen?fach=${encodeURIComponent(subject.id)}`} className="lecture-tile">
      <h2 className="planning-column__title">
        {/* Soft hyphens: break long names between their parts. */}
        {subject.name.replace("konstruktionslehre", "\u00adkonstruktions\u00adlehre")}
      </h2>
      <p className="planning-column__date">
        {done} von {held} nachgearbeitet
        {started > 0 && `, ${started} angefangen`}
      </p>
      <div className="planning-progress">
        <div
          className="planning-progress__fill"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="lecture-tile__next">
        <span>
          {next
            ? `Weiter mit Vorlesung ${subject.sessions.indexOf(next) + 1}, ${formatDay(next)}`
            : "Alles nachgearbeitet"}
        </span>
        <span
          className={`planning-card__duration ${open > 0 ? "lecture-chip--open" : "lecture-chip--done"}`}
        >
          {open > 0 ? `${open} offen` : "aufgeholt"}
        </span>
      </p>
      {examText && <p className="lecture-tile__exam">{examText}</p>}
      {nextNote && <p className="lecture-tile__note">{nextNote}</p>}
    </Link>
  );
}

function SubjectDetail({
  subject,
  marks,
  notes,
  plans,
  now,
  onMark,
  onPlan,
  onNote,
}: {
  subject: LectureSubject;
  marks: Marks;
  notes: Notes;
  plans: Plans;
  now: Date;
  onMark: (keys: string[], status: LectureMark | null) => void;
  onPlan: (key: string, day: string) => void;
  onNote: (key: string, note: string) => Promise<boolean>;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const { held, done, started, open, share } = progressOf(subject, marks, now);
  const past = subject.sessions.filter((session) => new Date(session.end) <= now);
  const upcoming = subject.sessions.slice(past.length);
  const openSessions = openSessionsOf(subject, marks, now);
  const doneSessions = past.filter((session) => !openSessions.includes(session)).reverse();

  const renderCards = (sessions: LectureSession[], emptyText: string) => (
    <div className="planning-cards">
      <div className="planning-cards__stack">
        {sessions.map((session) => {
          const key = markKey(subject, session);
          const status = marks[key];
          const isDone = status === "done";
          const isCancelled = status === "cancelled";
          const number = subject.sessions.indexOf(session) + 1;
          const isStarted = status === "started";
          const isOpen = openSessions.includes(session);
          const openUpToHere = isOpen
            ? openSessions.filter((item) => item.start <= session.start)
            : [];
          const planned = key in plans && !isDone && !isCancelled;
          const openPanel = panel?.key === key ? panel.kind : null;
          const togglePanel = (kind: Panel["kind"]) =>
            setPanel(openPanel === kind ? null : { key, kind });
          const closePanel = () =>
            setPanel((current) => (current?.key === key ? null : current));

          return (
            <article key={key} className="planning-card">
              <div className="lecture-card__head">
                <h3
                  className="planning-card__title"
                  style={{
                    textDecoration: isDone || isCancelled ? "line-through" : "none",
                    opacity: isDone || isCancelled ? 0.72 : 1,
                  }}
                >
                  Vorlesung {number}
                </h3>
                <span
                  className={[
                    "planning-card__duration",
                    isDone ? "lecture-chip--done" : "",
                    isStarted ? "lecture-chip--open" : "",
                  ].join(" ")}
                >
                  {isCancelled ? "entfällt" : formatDay(session)}
                </span>
              </div>
              {openPanel === "note" ? (
                <NoteEditor
                  initial={notes[key] ?? ""}
                  onSave={(note) => onNote(key, note)}
                  onClose={closePanel}
                />
              ) : (
                notes[key] && (
                  <button
                    type="button"
                    className="lecture-note"
                    title="Kommentar bearbeiten"
                    onClick={() => togglePanel("note")}
                  >
                    {notes[key]}
                  </button>
                )
              )}
              <div className="planning-card__footer">
                <div className="planning-card__controls">
                  {!isCancelled && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone ? true : isStarted ? "mixed" : false}
                      aria-label={`Vorlesung ${number} nachgearbeitet`}
                      className="planning-card__toggle"
                      style={{
                        borderColor: isDone
                          ? "var(--accent-success)"
                          : isStarted
                            ? "var(--accent-warning)"
                            : "var(--border-color)",
                        background: isDone
                          ? "var(--accent-success-light)"
                          : isStarted
                            ? "linear-gradient(90deg, var(--accent-warning) 50%, transparent 50%)"
                            : "transparent",
                        color: isDone ? "var(--accent-success)" : "var(--text-secondary)",
                      }}
                      onClick={() => onMark([key], isDone ? null : "done")}
                    >
                      {isDone && <Check size={14} strokeWidth={2.6} />}
                    </button>
                  )}
                  <span className="lecture-card__time">
                    {isCancelled ? formatDay(session) : formatTime(session)}
                  </span>
                </div>
                <div className="lecture-card__actions">
                  {!isDone && !isCancelled && (
                    <>
                      <button
                        type="button"
                        aria-pressed={isStarted}
                        onClick={() => onMark([key], isStarted ? null : "started")}
                      >
                        Angefangen
                      </button>
                      <button
                        type="button"
                        className={planned ? "is-planned" : undefined}
                        aria-expanded={openPanel === "plan"}
                        onClick={() => togglePanel("plan")}
                      >
                        {planned
                          ? plans[key]
                            ? formatDate(plans[key])
                            : "Eingeplant"
                          : "Einplanen"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={`Mehr zu Vorlesung ${number}`}
                    aria-expanded={openPanel === "menu"}
                    onClick={() => togglePanel("menu")}
                  >
                    <Ellipsis size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {openPanel === "menu" && (
                <div className="lecture-card__actions lecture-card__panel">
                  <button type="button" onClick={() => togglePanel("note")}>
                    {notes[key] ? "Kommentar ändern" : "Kommentar"}
                  </button>
                  {openUpToHere.length > 1 && (
                    <button
                      type="button"
                      title="Diese und alle früheren abhaken"
                      onClick={() => {
                        onMark(
                          openUpToHere.map((item) => markKey(subject, item)),
                          "done"
                        );
                        closePanel();
                      }}
                    >
                      Bis hier abhaken
                    </button>
                  )}
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => {
                        onMark([key], isCancelled ? null : "cancelled");
                        closePanel();
                      }}
                    >
                      {isCancelled ? "Findet statt" : "Fällt aus"}
                    </button>
                  )}
                </div>
              )}

              {openPanel === "plan" && (
                <PlanPicker
                  now={now}
                  onPick={(day) => {
                    onPlan(key, day);
                    closePanel();
                  }}
                />
              )}
            </article>
          );
        })}
        {sessions.length === 0 && <p className="backlog-empty-copy">{emptyText}</p>}
      </div>
    </div>
  );

  const columns = [
    {
      title: "Offen",
      copy: open > 0 ? `Weiter mit ${formatDay(openSessions[0])}` : "Du bist auf dem Stand.",
      share: held > 0 ? open / held : 0,
      cards: renderCards(openSessions, "Nichts nachzuholen."),
    },
    {
      title: "Nachgearbeitet",
      copy: `${done} von ${held}${started > 0 ? `, ${started} angefangen` : " Vorlesungen"}`,
      share,
      cards: renderCards(doneSessions, "Noch nichts abgehakt."),
    },
    {
      title: "Kommend",
      copy: upcoming.length > 0 ? `Nächste am ${formatDay(upcoming[0])}` : "Keine mehr im Semester.",
      share: upcoming.length / subject.sessions.length,
      cards: renderCards(upcoming, "Keine weiteren Vorlesungen."),
    },
  ];

  return (
    <div className="backlog-columns">
      {columns.map((column) => (
        <section key={column.title} className="planning-column">
          <div className="planning-column__inner">
            <div className="planning-column__heading">
              <h2 className="planning-column__title">{column.title}</h2>
              <p className="planning-column__date">{column.copy}</p>
              <div className="planning-progress">
                <div
                  className="planning-progress__fill"
                  style={{ width: `${column.share * 100}%` }}
                />
              </div>
              {column.cards}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function NoteEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (text.trim() === initial) {
      onClose();
      return;
    }
    setSaving(true);
    const ok = await onSave(text);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="lecture-note-editor">
      <textarea
        autoFocus
        rows={3}
        maxLength={1000}
        value={text}
        aria-label="Kommentar"
        placeholder="z. B. bis Folie 20, Rest fehlt"
        onFocus={(event) => event.target.setSelectionRange(text.length, text.length)}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <div className="lecture-card__actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
          className="lecture-note-editor__save"
          disabled={saving}
          onClick={() => void submit()}
        >
          {saving ? "Speichert..." : "Speichern"}
        </button>
      </div>
    </div>
  );
}

/** Picks the day for the task: today, tomorrow or any date. */
function PlanPicker({ now, onPick }: { now: Date; onPick: (day: string) => void }) {
  const [day, setDay] = useState("");
  const valid = /^20\d\d-/.test(day);

  return (
    <div className="lecture-card__actions lecture-card__panel">
      <button type="button" onClick={() => onPick(toLocalDateString(now))}>
        Heute
      </button>
      <button type="button" onClick={() => onPick(toLocalDateString(addDays(now, 1)))}>
        Morgen
      </button>
      <input
        type="date"
        className="lecture-card__date"
        aria-label="Anderer Tag"
        value={day}
        onChange={(event) => setDay(event.target.value)}
      />
      {valid && (
        <button type="button" className="lecture-note-editor__save" onClick={() => onPick(day)}>
          OK
        </button>
      )}
    </div>
  );
}

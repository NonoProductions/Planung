"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useObjectiveStore } from "@/stores/objectiveStore";
import type { Objective } from "@/types";

const MAX_OBJECTIVES = 5;

interface Props {
  weekStart: string;
}

export default function WeeklyObjectives({ weekStart }: Props) {
  const { objectives, loading, fetchObjectives, addObjective, updateObjective, deleteObjective } =
    useObjectiveStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchObjectives(weekStart);
  }, [weekStart, fetchObjectives]);

  useEffect(() => {
    if (showAdd && inputRef.current) inputRef.current.focus();
  }, [showAdd]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    addObjective({ title, weekStart });
    setNewTitle("");
    setShowAdd(false);
  }

  function startEdit(obj: Objective) {
    setEditingId(obj.id);
    setEditTitle(obj.title);
  }

  function handleEditSubmit(e: React.FormEvent, id: string) {
    e.preventDefault();
    const title = editTitle.trim();
    if (title) updateObjective(id, { title });
    setEditingId(null);
  }

  function toggleProgress(obj: Objective) {
    const newProgress = obj.progress >= 100 ? 0 : obj.progress >= 50 ? 100 : 50;
    updateObjective(obj.id, { progress: newProgress });
  }

  const weekObjectives = objectives.filter((objective) => objective.weekStart === weekStart);
  const canAddMore = weekObjectives.length < MAX_OBJECTIVES;

  const averageProgress =
    weekObjectives.length > 0
      ? weekObjectives.reduce((sum, objective) => sum + objective.progress, 0) /
        weekObjectives.length
      : 0;

  return (
    <section className="week-objectives">
      <div className="week-objectives__head">
        <div className="min-w-0">
          <h2 className="week-day__title">Wochenziele</h2>
          <p className="week-day__date">
            {weekObjectives.length} von {MAX_OBJECTIVES} gesetzt
          </p>
        </div>

        <div className="planning-progress week-objectives__progress">
          <div
            className="planning-progress__fill"
            style={{ width: `${averageProgress}%` }}
          />
        </div>

        {canAddMore ? (
          <button
            type="button"
            onClick={() => setShowAdd((current) => !current)}
            className="planning-toolbar__button"
          >
            <Plus size={14} strokeWidth={2} />
            Ziel hinzufügen
          </button>
        ) : (
          <p className="week-column__hint">Maximal {MAX_OBJECTIVES} Ziele pro Woche.</p>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAddSubmit} className="planning-add-form week-objectives__form">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setShowAdd(false);
                setNewTitle("");
              }
            }}
            placeholder="Ziel für diese Woche..."
            className="planning-add-form__input"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-subtle)",
            }}
            maxLength={120}
          />
          <div className="planning-add-form__controls">
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="planning-add-form__save disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-primary)" }}
            >
              Speichern
            </button>
          </div>
        </form>
      )}

      <div className="week-objectives__cards">
        <div className="contents">
          {loading && weekObjectives.length === 0 ? (
            <p className="backlog-empty-copy">Wird geladen...</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {weekObjectives.map((objective) => {
                const done = objective.progress >= 100;

                return (
                  <motion.article
                    key={objective.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="group planning-card"
                  >
                    {editingId === objective.id ? (
                      <form onSubmit={(event) => handleEditSubmit(event, objective.id)}>
                        <input
                          ref={editRef}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          onBlur={(event) =>
                            handleEditSubmit(event as unknown as React.FormEvent, objective.id)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          className="planning-add-form__input"
                          style={{
                            borderColor: "var(--accent-primary)",
                            color: "var(--text-primary)",
                            backgroundColor: "var(--surface-subtle)",
                          }}
                        />
                      </form>
                    ) : (
                      <>
                        <div className="planning-card__header">
                          <h3
                            className="planning-card__title min-w-0 flex-1 cursor-pointer select-none"
                            style={{
                              textDecoration: done ? "line-through" : "none",
                              opacity: done ? 0.72 : 1,
                            }}
                            onDoubleClick={() => startEdit(objective)}
                            title="Doppelklick zum Bearbeiten"
                          >
                            {objective.title}
                          </h3>
                        </div>

                        <div className="planning-progress week-objective__progress">
                          <motion.div
                            initial={false}
                            animate={{ width: `${objective.progress}%` }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className="planning-progress__fill"
                            style={{
                              background: done
                                ? "var(--accent-success)"
                                : objective.progress >= 50
                                  ? "var(--accent-primary)"
                                  : "var(--accent-warning)",
                            }}
                          />
                        </div>

                        <div className="planning-card__footer">
                          <div className="planning-card__controls">
                            <button
                              type="button"
                              onClick={() => toggleProgress(objective)}
                              className="planning-card__toggle"
                              style={{
                                borderColor: done ? "var(--accent-success)" : "var(--border-color)",
                              }}
                              aria-label="Fortschritt ändern"
                            >
                              <ProgressIcon progress={objective.progress} />
                            </button>

                            <button
                              type="button"
                              onClick={() => startEdit(objective)}
                              className="planning-card__ghost-action"
                              style={{
                                backgroundColor: "var(--surface-sunken)",
                                color: "var(--text-secondary)",
                              }}
                              aria-label="Ziel bearbeiten"
                            >
                              <Pencil size={12} strokeWidth={2} />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteObjective(objective.id)}
                              className="planning-card__ghost-action"
                              style={{
                                backgroundColor: "var(--surface-sunken)",
                                color: "var(--text-secondary)",
                              }}
                              aria-label="Ziel löschen"
                            >
                              <Trash2 size={12} strokeWidth={2} />
                            </button>
                          </div>

                          <span className="planning-card__duration">
                            {done
                              ? "Abgeschlossen"
                              : objective.progress >= 50
                                ? "In Arbeit"
                                : "Offen"}
                          </span>
                        </div>
                      </>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
          )}

          {!loading && weekObjectives.length === 0 && (
            <p className="backlog-empty-copy">Noch keine Ziele für diese Woche.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProgressIcon({ progress }: { progress: number }) {
  if (progress >= 100) {
    return (
      <div
        className="flex h-4 w-4 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--accent-success)" }}
      >
        <Check size={10} strokeWidth={2.8} color="white" />
      </div>
    );
  }

  if (progress >= 50) {
    return (
      <div
        className="h-4 w-4 rounded-full border-2"
        style={{
          borderColor: "var(--accent-primary)",
          background: `conic-gradient(var(--accent-primary) 180deg, transparent 180deg)`,
        }}
      />
    );
  }

  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, Target } from "lucide-react";
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

  return (
    <div className="weekly-objectives">
      <div className="weekly-objectives__header">
        <Target size={15} strokeWidth={1.8} style={{ color: "var(--accent-primary)" }} />
        <span
          className="text-[13px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
        >
          Wochenziele
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: "var(--bg-hover)",
            color: "var(--text-muted)",
          }}
        >
          {weekObjectives.length}/{MAX_OBJECTIVES}
        </span>
      </div>

      {loading && weekObjectives.length === 0 ? (
        <div className="weekly-objectives__list">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-[18px]"
              style={{ backgroundColor: "var(--bg-hover)" }}
            />
          ))}
        </div>
      ) : (
        <div className="weekly-objectives__list">
          <AnimatePresence mode="popLayout">
            {weekObjectives.map((objective) => (
              <motion.div
                key={objective.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="weekly-objectives__card group"
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
                      className="w-full rounded-lg bg-transparent text-[14px] font-medium outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </form>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleProgress(objective)}
                        className="mt-0.5 shrink-0 rounded-md transition-all duration-150"
                        aria-label="Fortschritt aendern"
                      >
                        <ProgressIcon progress={objective.progress} />
                      </button>

                      <span
                        className="flex-1 cursor-pointer select-none text-[14px] font-medium leading-[1.5]"
                        style={{
                          color:
                            objective.progress >= 100
                              ? "var(--text-muted)"
                              : "var(--text-primary)",
                          textDecoration: objective.progress >= 100 ? "line-through" : "none",
                        }}
                        onDoubleClick={() => startEdit(objective)}
                        title="Doppelklick zum Bearbeiten"
                      >
                        {objective.title}
                      </span>

                      <button
                        onClick={() => deleteObjective(objective.id)}
                        className="shrink-0 rounded-lg p-1 opacity-60 transition-all duration-150 md:opacity-0 md:group-hover:opacity-100"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.color = "var(--accent-danger)";
                          event.currentTarget.style.backgroundColor = "var(--accent-danger-light)";
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.color = "var(--text-muted)";
                          event.currentTarget.style.backgroundColor = "transparent";
                        }}
                        aria-label="Ziel loeschen"
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </div>

                    <div className="mt-3.5">
                      <div
                        className="h-1 overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--bg-hover)" }}
                      >
                        <motion.div
                          initial={false}
                          animate={{ width: `${objective.progress}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor:
                              objective.progress >= 100
                                ? "var(--accent-success)"
                                : objective.progress >= 50
                                  ? "var(--accent-primary)"
                                  : "var(--accent-warning)",
                          }}
                        />
                      </div>
                      <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {objective.progress >= 100
                          ? "Abgeschlossen"
                          : objective.progress >= 50
                            ? "In Arbeit"
                            : "Noch nicht gestartet"}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAdd ? (
          <motion.form
            key="add-form"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            onSubmit={handleAddSubmit}
            className="weekly-objectives__card"
          >
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
              placeholder="Ziel fuer diese Woche..."
              className="w-full bg-transparent text-[13.5px] font-medium outline-none placeholder:text-[var(--text-muted)]"
              style={{ color: "var(--text-primary)" }}
              maxLength={120}
            />
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 disabled:opacity-40"
                style={{
                  backgroundColor: "var(--accent-primary)",
                  color: "white",
                }}
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setNewTitle("");
                }}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
                style={{ color: "var(--text-muted)" }}
              >
                Abbrechen
              </button>
            </div>
          </motion.form>
        ) : canAddMore ? (
          <motion.button
            key="add-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowAdd(true)}
            className="weekly-objectives__add-button"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--bg-hover)";
              event.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
              event.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Plus size={14} strokeWidth={2} />
            Ziel hinzufuegen
          </motion.button>
        ) : (
          <p className="mt-2 px-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Maximal {MAX_OBJECTIVES} Ziele pro Woche.
          </p>
        )}
      </AnimatePresence>

      {weekObjectives.length > 0 && (
        <p className="mt-2 px-1 text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Klicke auf das Icon zum Fortschritt-Wechseln. Doppelklick auf den Titel zum
          Bearbeiten.
        </p>
      )}
    </div>
  );
}

function ProgressIcon({ progress }: { progress: number }) {
  if (progress >= 100) {
    return (
      <div
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--accent-success)" }}
      >
        <Check size={11} strokeWidth={2.5} color="white" />
      </div>
    );
  }

  if (progress >= 50) {
    return (
      <div
        className="h-5 w-5 rounded-full border-2"
        style={{
          borderColor: "var(--accent-primary)",
          background: `conic-gradient(var(--accent-primary) 180deg, transparent 180deg)`,
        }}
      />
    );
  }

  return (
    <div
      className="h-5 w-5 rounded-full border-2"
      style={{ borderColor: "var(--border-color)" }}
    />
  );
}

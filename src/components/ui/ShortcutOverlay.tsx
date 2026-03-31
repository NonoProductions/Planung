"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Command, Keyboard, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const SHORTCUTS = [
  { keys: ["A"], label: "Task hinzufuegen", detail: "Oeffnet Quick Add fuer den aktuellen Kontext." },
  { keys: ["P"], label: "Planning Ritual", detail: "Oeffnet die eigene Daily-Planning-Seite." },
  { keys: ["F"], label: "Focus Mode", detail: "Fokussiert die ausgewaehlte Aufgabe." },
  { keys: ["Shift", "L"], label: "Theme umschalten", detail: "Wechselt zwischen Dark und Light." },
  { keys: ["T"], label: "Heute", detail: "Springt zur heutigen Tagesansicht." },
  { keys: ["←", "→"], label: "Tag wechseln", detail: "Navigiert zum vorherigen oder naechsten Tag." },
  { keys: ["E"], label: "Task bearbeiten", detail: "Bearbeitet die aktuell ausgewaehlte Aufgabe." },
  { keys: ["D"], label: "Task erledigen", detail: "Schaltet den Status der Auswahl um." },
  { keys: ["Backspace"], label: "Task loeschen", detail: "Loescht die Auswahl direkt." },
  { keys: ["?"], label: "Shortcut-Hilfe", detail: "Oeffnet diese Uebersicht." },
  { keys: ["Ctrl", "?"], label: "Shortcut-Hilfe", detail: "Alternative fuer Systeme mit anderem Layout." },
  { keys: ["Esc"], label: "Schliessen", detail: "Schliesst Panels, Modal-Ansichten oder Quick Add." },
  { keys: ["B"], label: "Backlog", detail: "Wechselt direkt in den Backlog." },
  { keys: ["1-9"], label: "Zeitschaetzung", detail: "Setzt 1 bis 9 Stunden fuer die Auswahl." },
  { keys: ["Shift", "C"], label: "Kalender", detail: "Blendet das Kalenderpanel ein oder aus." },
];

export default function ShortcutOverlay() {
  const open = useUIStore((state) => state.shortcutHelpOpen);
  const closeShortcutHelp = useUIStore((state) => state.closeShortcutHelp);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6"
          style={{
            backgroundColor: "rgba(23, 19, 16, 0.38)",
            backdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeShortcutHelp();
            }
          }}
        >
          <motion.div
            className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[34px]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,245,239,0.96))",
              border: "1px solid rgba(227, 218, 209, 0.94)",
              boxShadow: "0 30px 90px rgba(88, 75, 57, 0.18)",
            }}
          >
            <div
              className="flex items-start gap-4 px-5 py-5 sm:px-7 sm:py-6"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(141, 124, 246, 0.18), rgba(255,255,255,0.96))",
                  color: "var(--accent-primary)",
                }}
              >
                <Keyboard size={20} strokeWidth={1.9} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.24em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Keyboard Shortcuts
                  </p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: "rgba(141, 124, 246, 0.12)",
                      color: "var(--accent-primary)",
                    }}
                  >
                    <Command size={12} strokeWidth={2} />
                    Global aktiv
                  </span>
                </div>

                <h2
                  className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.06em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Schnell arbeiten, ohne die Maus zu suchen
                </h2>
                <p
                  className="mt-3 max-w-[60ch] text-[14px] leading-7"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Die taskbezogenen Shortcuts greifen auf die aktuell ausgewaehlte
                  Aufgabe. Klick eine Karte an, dann stehen Bearbeiten, Erledigen,
                  Fokus und Zeitschaetzung sofort bereit.
                </p>
              </div>

              <button
                type="button"
                onClick={closeShortcutHelp}
                className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors"
                style={{ color: "var(--text-muted)" }}
                aria-label="Shortcut-Hilfe schliessen"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={`${shortcut.label}-${shortcut.keys.join("-")}`}
                  className="rounded-[24px] border px-4 py-4"
                  style={{
                    borderColor: "rgba(227, 218, 209, 0.92)",
                    backgroundColor: "rgba(255, 255, 255, 0.84)",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {shortcut.keys.map((keyPart) => (
                      <kbd
                        key={keyPart}
                        className="rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                        style={{
                          borderColor: "rgba(227, 218, 209, 0.96)",
                          backgroundColor: "rgba(249, 245, 239, 0.96)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {keyPart}
                      </kbd>
                    ))}
                  </div>

                  <p
                    className="mt-4 text-[15px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {shortcut.label}
                  </p>
                  <p
                    className="mt-2 text-[13px] leading-6"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {shortcut.detail}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

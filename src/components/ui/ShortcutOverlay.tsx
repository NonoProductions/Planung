"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const SHORTCUTS = [
  { keys: ["A"], label: "Task hinzufügen", detail: "Öffnet Quick Add für den aktuellen Kontext." },
  { keys: ["P"], label: "Planning Ritual", detail: "Öffnet die eigene Daily-Planning-Seite." },
  { keys: ["F"], label: "Focus Mode", detail: "Fokussiert die ausgewählte Aufgabe." },
  { keys: ["Shift", "L"], label: "Theme umschalten", detail: "Wechselt zwischen Dark und Light." },
  { keys: ["T"], label: "Heute", detail: "Springt zur heutigen Tagesansicht." },
  { keys: ["←", "→"], label: "Tag wechseln", detail: "Navigiert zum vorherigen oder nächsten Tag." },
  { keys: ["E"], label: "Task bearbeiten", detail: "Bearbeitet die aktuell ausgewählte Aufgabe." },
  { keys: ["D"], label: "Task erledigen", detail: "Schaltet den Status der Auswahl um." },
  { keys: ["Backspace"], label: "Task löschen", detail: "Löscht die Auswahl direkt." },
  { keys: ["?"], label: "Shortcut-Hilfe", detail: "Öffnet diese Übersicht." },
  { keys: ["Ctrl", "?"], label: "Shortcut-Hilfe", detail: "Alternative für Systeme mit anderem Layout." },
  { keys: ["Esc"], label: "Schließen", detail: "Schließt Panels, Modal-Ansichten oder Quick Add." },
  { keys: ["B"], label: "Backlog", detail: "Wechselt direkt in den Backlog." },
  { keys: ["1-9"], label: "Zeitschätzung", detail: "Setzt 1 bis 9 Stunden für die Auswahl." },
  { keys: ["Shift", "C"], label: "Kalender", detail: "Blendet das Kalenderpanel ein oder aus." },
];

const SHORTCUT_COLUMNS = [SHORTCUTS.slice(0, 8), SHORTCUTS.slice(8)];

export default function ShortcutOverlay() {
  const open = useUIStore((state) => state.shortcutHelpOpen);
  const closeShortcutHelp = useUIStore((state) => state.closeShortcutHelp);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-overlay z-[160]"
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
            className="ritual-modal ritual-modal--board flex w-full max-w-[920px] min-h-0 max-h-[calc(100dvh-32px)] flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="planning-toolbar ritual-modal__toolbar">
              <div className="flex min-w-0 items-center gap-2">
                <Keyboard size={16} strokeWidth={2} style={{ color: "var(--accent-primary)" }} />
                <span className="settings-toolbar__title truncate">Tastenkürzel</span>
                <span className="workspace-badge workspace-badge--accent">Global aktiv</span>
              </div>
              <button
                type="button"
                onClick={closeShortcutHelp}
                className="planning-toolbar__button planning-toolbar__button--icon"
                aria-label="Shortcut-Hilfe schließen"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="ritual-modal__columns">
              {SHORTCUT_COLUMNS.map((column, columnIndex) => (
                <section key={columnIndex} className="analytics-section">
                  {columnIndex === 0 ? (
                    <p className="settings-row__description" style={{ marginTop: 0 }}>
                      Taskbezogene Shortcuts greifen auf die ausgewählte Aufgabe.
                      Klick eine Karte an, dann stehen Bearbeiten, Erledigen, Fokus
                      und Zeitschätzung sofort bereit.
                    </p>
                  ) : (
                    <p className="settings-row__description" style={{ marginTop: 0 }}>
                      Navigation und Ansichten funktionieren überall in der App.
                    </p>
                  )}
                  <div className="analytics-section__body ritual-list">
                    {column.map((shortcut) => (
                      <div
                        key={`${shortcut.label}-${shortcut.keys.join("-")}`}
                        className="ritual-row"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="settings-row__label">{shortcut.label}</p>
                          <p className="settings-row__description">{shortcut.detail}</p>
                        </div>
                        <div className="app-kbd-group">
                          {shortcut.keys.map((keyPart) => (
                            <kbd key={keyPart} className="app-kbd">
                              {keyPart}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

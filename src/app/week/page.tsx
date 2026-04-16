"use client";

import { useState } from "react";
import { addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import WeeklyObjectives from "@/components/weekly/WeeklyObjectives";
import WeekGrid from "@/components/weekly/WeekGrid";
import WeeklyReviewModal from "@/components/weekly/WeeklyReviewModal";
import DndWrapper from "@/components/dnd/DndWrapper";
import { toLocalDateString } from "@/lib/date";

function getWeekStart(date: Date): string {
  return toLocalDateString(startOfWeek(date, { weekStartsOn: 1 }));
}

export default function WeekPage() {
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showReview, setShowReview] = useState(false);
  const [objectivesVisible, setObjectivesVisible] = useState(false);

  const weekStartStr = getWeekStart(currentWeek);

  const weekLabel = `${format(currentWeek, "d. MMM", { locale: de })} - ${format(addWeeks(currentWeek, 1), "d. MMM yyyy", {
    locale: de,
  })}`;

  function prevWeek() {
    setCurrentWeek((date) => subWeeks(date, 1));
  }

  function nextWeek() {
    setCurrentWeek((date) => addWeeks(date, 1));
  }

  function goToCurrentWeek() {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  return (
    <DndWrapper>
      <AppShell>
        <div className="app-main-surface">
          <div className="week-page-shell">
            <div className="week-page-toolbar">
              <div className="week-page-toolbar__nav">
                <button
                  onClick={prevWeek}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    event.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent";
                    event.currentTarget.style.color = "var(--text-muted)";
                  }}
                  aria-label="Vorherige Woche"
                >
                  <ChevronLeft size={16} strokeWidth={1.8} />
                </button>

                <button
                  onClick={goToCurrentWeek}
                  className="rounded-xl px-4 py-2 text-[14px] font-medium transition-colors duration-150"
                  style={{ color: "var(--text-primary)" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {weekLabel}
                </button>

                <button
                  onClick={nextWeek}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    event.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "transparent";
                    event.currentTarget.style.color = "var(--text-muted)";
                  }}
                  aria-label="Naechste Woche"
                >
                  <ChevronRight size={16} strokeWidth={1.8} />
                </button>
              </div>

              <div className="week-page-toolbar__meta" style={{ color: "var(--text-muted)" }}>
                Wochenfokus
              </div>

              <button
                type="button"
                onClick={() => setObjectivesVisible((prev) => !prev)}
                className="week-page-toolbar__toggle"
                aria-pressed={objectivesVisible}
                aria-label={
                  objectivesVisible ? "Linke Spalte ausblenden" : "Linke Spalte einblenden"
                }
              >
                {objectivesVisible ? "Ziele ausblenden" : "Ziele einblenden"}
              </button>

              <div className="ml-auto">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowReview(true)}
                  className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[13px] font-medium transition-all duration-150"
                  style={{
                    backgroundColor: "var(--accent-glow)",
                    color: "var(--accent-primary)",
                    border: "1px solid rgba(47, 111, 228, 0.14)",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--accent-primary-light)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = "var(--accent-glow)";
                  }}
                >
                  <BarChart2 size={14} strokeWidth={2} />
                  Wochenrueckblick
                </motion.button>
              </div>
            </div>


            <div className="week-page-layout">
              <div
                className={
                  objectivesVisible
                    ? "week-page-objectives"
                    : "week-page-objectives week-page-objectives--collapsed"
                }
              >
                {objectivesVisible && <WeeklyObjectives weekStart={weekStartStr} />}
              </div>

              <div className="week-page-grid">
                <WeekGrid weekStart={weekStartStr} />
              </div>
            </div>
          </div>
        </div>

        {showReview && (
          <WeeklyReviewModal
            weekStart={weekStartStr}
            onClose={() => setShowReview(false)}
          />
        )}
      </AppShell>
    </DndWrapper>
  );
}
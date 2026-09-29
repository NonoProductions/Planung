"use client";

import { useState } from "react";
import { addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MobileDateNav from "@/components/layout/MobileDateNav";
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
      <AppShell
        mobileCenter={
          <MobileDateNav
            label={`KW ${format(currentWeek, "I", { locale: de })}`}
            onPrev={prevWeek}
            onNext={nextWeek}
            onReset={goToCurrentWeek}
            prevLabel="Vorherige Woche"
            nextLabel="Nächste Woche"
          />
        }
        mobileAction={
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="mobile-topbar__button"
            aria-label="Wochenrückblick"
          >
            <BarChart2 size={18} strokeWidth={2.1} />
          </button>
        }
      >
        <div className="app-main-surface">
          <section className="planning-board">
            <div className="planning-toolbar">
              <div className="planning-toolbar__group planning-toolbar__group--nav">
                <button
                  type="button"
                  onClick={prevWeek}
                  className="planning-toolbar__button planning-toolbar__button--icon"
                  aria-label="Vorherige Woche"
                >
                  <ChevronLeft size={16} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={goToCurrentWeek}
                  className="planning-toolbar__button"
                >
                  {weekLabel}
                </button>

                <button
                  type="button"
                  onClick={nextWeek}
                  className="planning-toolbar__button planning-toolbar__button--icon"
                  aria-label="Nächste Woche"
                >
                  <ChevronRight size={16} strokeWidth={2} />
                </button>
              </div>

              <div className="planning-toolbar__group">
                <button
                  type="button"
                  onClick={() => setShowReview(true)}
                  className="planning-toolbar__button"
                >
                  <BarChart2 size={14} strokeWidth={2} />
                  Wochenrückblick
                </button>
              </div>
            </div>

            <div className="week-scroll">
              <WeeklyObjectives weekStart={weekStartStr} />
              <WeekGrid weekStart={weekStartStr} />
            </div>
          </section>
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

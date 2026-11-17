"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toLocalDateString } from "@/lib/date";
import { haptic } from "@/lib/haptics";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface Props {
  /** Selected day as yyyy-MM-dd. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day as yyyy-MM-dd. */
  min?: string;
}

/** Month view with one row per week (Monday first), so weekdays line up at a glance. */
export default function MiniCalendar({ value, onChange, min }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value)));
  const today = toLocalDateString(new Date());

  const weeks: string[][] = [];
  let day = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  while (day <= last) {
    const week: string[] = [];
    for (let index = 0; index < 7; index++) {
      week.push(toLocalDateString(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const canGoBack = !min || toLocalDateString(endOfMonth(subMonths(month, 1))) >= min;

  return (
    <div className="mini-cal">
      <div className="mini-cal__head">
        <button
          type="button"
          className="mini-cal__nav"
          onClick={() => setMonth((current) => subMonths(current, 1))}
          disabled={!canGoBack}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft size={16} strokeWidth={2.2} />
        </button>
        <span className="mini-cal__month">{format(month, "MMMM yyyy", { locale: de })}</span>
        <button
          type="button"
          className="mini-cal__nav"
          onClick={() => setMonth((current) => addMonths(current, 1))}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div className="mini-cal__grid" role="grid">
        <div className="mini-cal__weekdays" role="row">
          {WEEKDAYS.map((label, index) => (
            <span
              key={label}
              role="columnheader"
              className={`mini-cal__weekday${index >= 5 ? " is-weekend" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0]} className="mini-cal__week" role="row">
            {week.map((date, index) => {
              const outside = !isSameMonth(parseISO(date), month);
              const disabled = Boolean(min && date < min);
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  onClick={() => {
                    haptic("select");
                    onChange(date);
                  }}
                  className={[
                    "mini-cal__day",
                    index >= 5 ? "is-weekend" : "",
                    outside ? "is-outside" : "",
                    date === today ? "is-today" : "",
                    date === value ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-selected={date === value}
                  aria-label={format(parseISO(date), "EEEE, d. MMMM", { locale: de })}
                >
                  {format(parseISO(date), "d")}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

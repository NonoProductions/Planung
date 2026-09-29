"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Parses loose 24h input ("9", "930", "13:5", "1330", "13.30") into "HH:MM".
 * Returns null while the input is not (yet) a valid time of day.
 */
export function parseTime24(raw: string): string | null {
  const cleaned = raw.trim().replace(/[.,h]/g, ":");
  let hours: number;
  let minutes: number;

  if (cleaned.includes(":")) {
    const [h, m = "0"] = cleaned.split(":");
    if (!/^\d{1,2}$/.test(h) || !/^\d{0,2}$/.test(m)) return null;
    hours = Number(h);
    minutes = Number(m || "0");
  } else {
    if (!/^\d{1,4}$/.test(cleaned)) return null;
    if (cleaned.length <= 2) {
      hours = Number(cleaned);
      minutes = 0;
    } else {
      hours = Number(cleaned.slice(0, cleaned.length - 2));
      minutes = Number(cleaned.slice(-2));
    }
  }

  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Always-24h time field. The native <input type="time"> follows the OS locale
 * and shows AM/PM on many systems, so this uses a plain text field instead.
 */
export default function TimeInput({
  value,
  onChange,
  onKeyDown,
  className = "workspace-input",
  "aria-label": ariaLabel,
}: TimeInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder="HH:MM"
      value={draft ?? value}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = parseTime24(event.target.value);
        if (parsed) onChange(parsed);
      }}
      onFocus={(event) => event.target.select()}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") setDraft(null);
        onKeyDown?.(event);
      }}
      className={`${className} time-input`}
      aria-label={ariaLabel}
    />
  );
}

"use client";

import { useState, useEffect } from "react";

interface CurrentTimeLineProps {
  startHour: number;
  hourHeight: number;
  gutterWidth?: number;
}

export default function CurrentTimeLine({
  startHour,
  hourHeight,
}: CurrentTimeLineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const top = (hours - startHour + minutes / 60) * hourHeight;

  if (hours < startHour || hours >= 22) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-30"
      style={{ top }}
    >
      <div
        className="h-[2px] w-full"
        style={{ backgroundColor: "var(--current-time-line)" }}
      />
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { formatCompactMinutes } from "@/lib/time-tracking";

interface DonutTimerProps {
  planned: number;
  actual?: number;
  size?: number;
}

export default function DonutTimer({
  planned,
  actual = 0,
  size = 34,
}: DonutTimerProps) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = planned > 0 ? Math.min(actual / planned, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const isOvertime = actual > planned;

  const progressColor = isOvertime
    ? "var(--accent-danger)"
    : actual > 0
      ? "var(--accent-success)"
      : "var(--border-color)";

  const displayTime =
    planned >= 60
      ? `${Math.floor(planned / 60)}h`
      : `${planned}m`;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={`Geplant: ${formatCompactMinutes(planned)}${actual ? ` / Tatsaechlich: ${formatCompactMinutes(actual)}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        {actual > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progressColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </svg>
      <span
        className="absolute text-[9px] font-bold tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        {displayTime}
      </span>
    </div>
  );
}

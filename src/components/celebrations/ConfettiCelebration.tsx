"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const COLORS = ["#ff8f70", "#8d7cf6", "#57b679", "#f4ad46", "#67b9ea", "#f26d85"];

function seededValue(seed: number, index: number, offset: number) {
  const raw = Math.sin(seed * 0.001 + index * 12.9898 + offset * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

export default function ConfettiCelebration() {
  const activeCelebration = useUIStore((state) => state.activeCelebration);
  const clearCelebration = useUIStore((state) => state.clearCelebration);

  useEffect(() => {
    if (!activeCelebration) return undefined;

    const durationByType = {
      confetti: 1900,
      checkmark: 1450,
      fireworks: 1750,
    } as const;

    const timeout = window.setTimeout(
      () => clearCelebration(),
      durationByType[activeCelebration.type]
    );

    return () => window.clearTimeout(timeout);
  }, [activeCelebration, clearCelebration]);

  const confettiPieces = useMemo(() => {
    if (!activeCelebration) return [];

    return Array.from({ length: 28 }, (_, index) => ({
      id: index,
      left: 6 + seededValue(activeCelebration.startedAt, index, 1) * 88,
      delay: seededValue(activeCelebration.startedAt, index, 2) * 0.32,
      drift: -130 + seededValue(activeCelebration.startedAt, index, 3) * 260,
      rotate: -160 + seededValue(activeCelebration.startedAt, index, 4) * 320,
      size: 8 + seededValue(activeCelebration.startedAt, index, 5) * 10,
      height: 12 + seededValue(activeCelebration.startedAt, index, 6) * 24,
      color: COLORS[index % COLORS.length],
    }));
  }, [activeCelebration]);

  const fireworksBursts = useMemo(() => {
    if (!activeCelebration) return [];

    return Array.from({ length: 3 }, (_, burstIndex) => ({
      id: burstIndex,
      left: 22 + burstIndex * 26 + seededValue(activeCelebration.startedAt, burstIndex, 7) * 6,
      top: 26 + seededValue(activeCelebration.startedAt, burstIndex, 8) * 26,
      rays: Array.from({ length: 12 }, (_, rayIndex) => ({
        id: rayIndex,
        angle: rayIndex * 30,
        color: COLORS[(burstIndex + rayIndex) % COLORS.length],
        delay: burstIndex * 0.12 + rayIndex * 0.015,
      })),
    }));
  }, [activeCelebration]);

  return (
    <AnimatePresence>
      {activeCelebration && (
        <motion.div
          key={activeCelebration.id}
          className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(var(--surface-rgb), 0.42)" }}
          />

          {activeCelebration.type === "confetti" &&
            confettiPieces.map((piece) => (
              <motion.span
                key={`${activeCelebration.id}-confetti-${piece.id}`}
                className="absolute block rounded-full"
                style={{
                  left: `${piece.left}%`,
                  top: "-12%",
                  width: piece.size,
                  height: piece.height,
                  backgroundColor: piece.color,
                  boxShadow: `0 0 0 1px ${piece.color}20`,
                }}
                initial={{ opacity: 0, y: -40, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: ["0vh", "118vh"],
                  x: [0, piece.drift],
                  rotate: [0, piece.rotate],
                }}
                transition={{
                  duration: 1.35 + piece.delay,
                  delay: piece.delay,
                  ease: [0.16, 0.84, 0.44, 1],
                }}
              />
            ))}

          {activeCelebration.type === "fireworks" &&
            fireworksBursts.map((burst) => (
              <div
                key={`${activeCelebration.id}-burst-${burst.id}`}
                className="absolute"
                style={{
                  left: `${burst.left}%`,
                  top: `${burst.top}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {burst.rays.map((ray) => (
                  <motion.span
                    key={`${activeCelebration.id}-burst-${burst.id}-ray-${ray.id}`}
                    className="absolute left-1/2 top-1/2 block rounded-full"
                    style={{
                      width: 4,
                      height: 96,
                      background: `linear-gradient(180deg, ${ray.color}, transparent)`,
                      transformOrigin: "50% 100%",
                      rotate: `${ray.angle}deg`,
                    }}
                    initial={{ opacity: 0, scaleY: 0.2 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scaleY: [0.2, 1, 0.24],
                      y: [0, -20, -52],
                    }}
                    transition={{
                      duration: 0.92,
                      delay: ray.delay,
                      ease: [0.25, 1, 0.5, 1],
                    }}
                  />
                ))}
              </div>
            ))}

          {activeCelebration.type === "checkmark" &&
            Array.from({ length: 12 }, (_, index) => (
              <motion.span
                key={`${activeCelebration.id}-spark-${index}`}
                className="absolute left-1/2 top-1/2 block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos((index / 12) * Math.PI * 2) * 120,
                  y: Math.sin((index / 12) * Math.PI * 2) * 120,
                  scale: [0.6, 1.1, 0.2],
                }}
                transition={{ duration: 0.9, delay: index * 0.02 }}
              />
            ))}

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="celebration-card"
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span
                className={`app-icon-tile${
                activeCelebration.type === "checkmark"
                  ? " app-icon-tile--success"
                  : activeCelebration.type === "fireworks"
                    ? " app-icon-tile--warning"
                    : ""
              }`}
                initial={{ rotate: -10, scale: 0.84 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeCelebration.type === "checkmark" ? (
                  <Check size={24} strokeWidth={2.6} />
                ) : (
                  <Sparkles size={22} strokeWidth={2.2} />
                )}
              </motion.span>
              <span className="workspace-badge workspace-badge--accent">Geschafft</span>
              <h3 className="celebration-card__title mt-3">{activeCelebration.title}</h3>
              <p className="celebration-card__subtitle">{activeCelebration.subtitle}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
            style={{
              background:
                activeCelebration.type === "fireworks"
                  ? "radial-gradient(circle at center, rgba(141, 124, 246, 0.16), transparent 48%)"
                  : "radial-gradient(circle at center, rgba(255, 255, 255, 0.28), transparent 42%)",
            }}
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

          <motion.div
            className="absolute left-1/2 top-1/2 flex w-[min(90vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px]"
              initial={{ rotate: -12, scale: 0.84 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background:
                  activeCelebration.type === "fireworks"
                    ? "linear-gradient(135deg, rgba(244, 173, 70, 0.28), rgba(141, 124, 246, 0.2))"
                    : activeCelebration.type === "checkmark"
                      ? "linear-gradient(135deg, rgba(87, 182, 121, 0.24), rgba(255, 255, 255, 0.92))"
                      : "linear-gradient(135deg, rgba(255, 143, 112, 0.24), rgba(255, 255, 255, 0.92))",
                border: "1px solid rgba(255, 255, 255, 0.64)",
                boxShadow: "0 24px 60px rgba(88, 75, 57, 0.18)",
              }}
            >
              {activeCelebration.type === "checkmark" ? (
                <Check size={34} strokeWidth={3} style={{ color: "var(--accent-success)" }} />
              ) : (
                <Sparkles
                  size={30}
                  strokeWidth={2.4}
                  style={{
                    color:
                      activeCelebration.type === "fireworks"
                        ? "var(--accent-warning)"
                        : "var(--accent-primary)",
                  }}
                />
              )}
            </motion.div>

            <div
              className="rounded-[30px] px-6 py-5"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.84)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.75)",
                boxShadow: "0 28px 60px rgba(88, 75, 57, 0.16)",
              }}
            >
              <p
                className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]"
                style={{ color: "var(--text-muted)" }}
              >
                Celebration
              </p>
              <h3
                className="mt-2 text-[1.8rem] font-semibold leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                {activeCelebration.title}
              </h3>
              <p
                className="mt-2 text-[0.96rem]"
                style={{ color: "var(--text-secondary)" }}
              >
                {activeCelebration.subtitle}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

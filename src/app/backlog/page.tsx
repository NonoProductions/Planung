"use client";

import { AnimatePresence, motion } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import BacklogList from "@/components/backlog/BacklogList";
import CalendarView from "@/components/layout/CalendarView";
import DndWrapper from "@/components/dnd/DndWrapper";
import { useUIStore } from "@/stores/uiStore";

export default function BacklogPage() {
  const calendarVisible = useUIStore((s) => s.calendarVisible);

  return (
    <DndWrapper>
      <AppShell>
        <div className="app-main-surface">
          <BacklogList />
        </div>

        <AnimatePresence initial={false}>
          {calendarVisible && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 28, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="app-side-surface"
            >
              <CalendarView />
            </motion.div>
          )}
        </AnimatePresence>
      </AppShell>
    </DndWrapper>
  );
}

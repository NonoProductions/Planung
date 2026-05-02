"use client";

import { AnimatePresence, motion } from "framer-motion";
import AppShell from "@/components/layout/AppShell";
import TaskList from "@/components/layout/TaskList";
import CalendarView from "@/components/layout/CalendarView";
import DndWrapper from "@/components/dnd/DndWrapper";
import { useUIStore } from "@/stores/uiStore";
import { useCalDavAutoSync } from "@/hooks/useCalDavAutoSync";

export default function HomeApp() {
  const calendarVisible = useUIStore((s) => s.calendarVisible);
  useCalDavAutoSync();

  return (
    <DndWrapper>
      <AppShell>
        <div className="app-main-surface">
          <TaskList />
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

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { addDays, format, isToday, parseISO, subDays } from "date-fns";
import { de } from "date-fns/locale";
import AppShell from "@/components/layout/AppShell";
import TaskList from "@/components/layout/TaskList";
import CalendarView from "@/components/layout/CalendarView";
import MobileDateNav from "@/components/layout/MobileDateNav";
import DndWrapper from "@/components/dnd/DndWrapper";
import { toLocalDateString } from "@/lib/date";
import { useUIStore } from "@/stores/uiStore";

function MobileDayNav() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDate);
  const baseDate = parseISO(selectedDate);

  return (
    <MobileDateNav
      label={isToday(baseDate) ? "Heute" : format(baseDate, "EEE, d. MMM", { locale: de })}
      onPrev={() => setSelectedDate(toLocalDateString(subDays(baseDate, 1)))}
      onNext={() => setSelectedDate(toLocalDateString(addDays(baseDate, 1)))}
      onReset={() => setSelectedDate(toLocalDateString(new Date()))}
      prevLabel="Vorheriger Tag"
      nextLabel="Nächster Tag"
    />
  );
}

export default function HomeApp() {
  const calendarVisible = useUIStore((s) => s.calendarVisible);

  return (
    <DndWrapper>
      <AppShell mobileCenter={<MobileDayNav />}>
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

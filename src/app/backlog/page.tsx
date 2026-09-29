"use client";

import AppShell from "@/components/layout/AppShell";
import BacklogList from "@/components/backlog/BacklogList";
import DndWrapper from "@/components/dnd/DndWrapper";

export default function BacklogPage() {
  return (
    <DndWrapper>
      <AppShell>
        <div className="app-main-surface">
          <BacklogList />
        </div>
      </AppShell>
    </DndWrapper>
  );
}

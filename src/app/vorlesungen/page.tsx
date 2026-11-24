import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import LectureTracker from "@/components/lectures/LectureTracker";

export default function LecturesPage() {
  return (
    <AppShell>
      <div className="app-main-surface">
        <Suspense>
            <LectureTracker />
          </Suspense>
      </div>
    </AppShell>
  );
}

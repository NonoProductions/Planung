import AppShell from "@/components/layout/AppShell";
import DailyPlanningPage from "@/components/rituals/DailyPlanningPage";

export default function PlanningPage() {
  return (
    <AppShell>
      <div className="app-main-surface">
        <DailyPlanningPage />
      </div>
    </AppShell>
  );
}

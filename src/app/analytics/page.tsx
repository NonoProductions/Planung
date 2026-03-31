import AppShell from "@/components/layout/AppShell";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="app-main-surface">
        <AnalyticsDashboard />
      </div>
    </AppShell>
  );
}

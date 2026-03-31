import AppShell from "@/components/layout/AppShell";
import SettingsDashboard from "@/components/settings/SettingsDashboard";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="app-main-surface">
        <SettingsDashboard />
      </div>
    </AppShell>
  );
}

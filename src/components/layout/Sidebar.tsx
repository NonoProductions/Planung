"use client";

import {
  BarChart3,
  CalendarCheck2,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  House,
  LogOut,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/stores/uiStore";
import { haptic } from "@/lib/haptics";

const mainNav = [
  { label: "Home", href: "/", icon: House },
  { label: "Backlog", href: "/backlog", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Weekly planning", shortLabel: "Weekly", href: "/week", icon: CalendarRange },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

const dayLinks = [
  { label: "Daily planning", icon: CalendarCheck2, href: "/planning" },
  { label: "Daily shutdown", icon: NotebookText, action: "shutdown" },
];

function SidebarRow({
  label,
  icon: Icon,
  active = false,
}: {
  label: string;
  icon: typeof House;
  active?: boolean;
}) {
  return (
    <div className={active ? "sidebar-row sidebar-row--active" : "sidebar-row"}>
      <span className="sidebar-row__icon">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="sidebar-row__label">{label}</span>
    </div>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);
  const toggleSidebarCollapsed = useUIStore((state) => state.toggleSidebarCollapsed);
  const itemTitle = (label: string) => (collapsed ? label : undefined);
  const openShutdownRitual = useUIStore((state) => state.openShutdownRitual);

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleClose = () => {
    setSidebarExpanded(false);
    onClose?.();
  };

  const handleDayAction = (action?: string) => {
    if (action === "shutdown") {
      openShutdownRitual();
      handleClose();
    }
  };

  const sidebarClassName = [
    "sidebar-panel",
    "flex",
    "h-full",
    "w-full",
    "flex-col",
    sidebarExpanded ? "sidebar-panel--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <aside id="app-navigation" className={sidebarClassName}>
        <div className="sidebar-panel__mobile-header">
          <div className="sidebar-brand">
            <button type="button" className="sidebar-brand__button">
              <span className="sidebar-brand__title">Noes Planer</span>
              <ChevronDown size={15} strokeWidth={2.2} className="sidebar-brand__chevron" />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="sidebar-collapse-toggle"
            aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
            title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
            aria-expanded={!collapsed}
            aria-controls="app-navigation"
          >
            {collapsed ? (
              <PanelLeftOpen size={17} strokeWidth={2} />
            ) : (
              <PanelLeftClose size={17} strokeWidth={2} />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="sidebar-mobile-close"
            aria-label="Navigation schließen"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <section className="sidebar-group sidebar-group--primary">
          <nav className="sidebar-group__stack">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="sidebar-item"
                  onClick={handleClose}
                  aria-current={active ? "page" : undefined}
                  title={itemTitle(item.label)}
                >
                  <SidebarRow label={item.label} icon={Icon} active={active} />
                </Link>
              );
            })}
          </nav>
        </section>

        <section className="sidebar-group">
          <div className="sidebar-group__header">
            <p className="sidebar-group__label">Day</p>
          </div>
          <div className="sidebar-group__stack">
            {dayLinks.map((item) => {
              if (item.href) {
                const active = isActiveRoute(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="sidebar-item"
                    onClick={handleClose}
                    aria-current={active ? "page" : undefined}
                    title={itemTitle(item.label)}
                  >
                    <SidebarRow label={item.label} icon={item.icon} active={active} />
                  </Link>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  className="sidebar-item sidebar-item--button"
                  onClick={() => handleDayAction(item.action)}
                  title={itemTitle(item.label)}
                >
                  <SidebarRow label={item.label} icon={item.icon} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="sidebar-group sidebar-group--footer">
          <button
            type="button"
            className="sidebar-item sidebar-item--button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <SidebarRow label="Abmelden" icon={LogOut} />
          </button>
        </section>
      </aside>

      <nav className="sidebar-mobile-dock" aria-label="Hauptnavigation">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={active ? "sidebar-mobile-dock__item sidebar-mobile-dock__item--active" : "sidebar-mobile-dock__item"}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (!active) haptic("select");
              }}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{"shortLabel" in item ? item.shortLabel : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

"use client";

import {
  BarChart3,
  CalendarCheck2,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Coffee,
  House,
  PencilLine,
  Settings2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/stores/uiStore";

const mainNav = [
  { label: "Home", href: "/", icon: House },
  { label: "Backlog", href: "/backlog", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Focus", href: "/week", icon: Coffee },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

const mobileDockNav = mainNav.filter((item) => item.href !== "/week");

const dayLinks = [
  { label: "Daily planning", icon: CalendarCheck2, href: "/planning" },
  { label: "Daily highlights", icon: PencilLine },
];

const weekLinks = [
  { label: "Weekly planning", icon: CalendarRange, href: "/weekly-planning" },
  { label: "Weekly review", icon: ClipboardList },
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
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const sidebarExpanded = useUIStore((state) => state.sidebarExpanded);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);

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
            onClick={handleClose}
            className="sidebar-mobile-close"
            aria-label="Navigation schliessen"
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
                >
                  <SidebarRow label={item.label} icon={item.icon} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="sidebar-group">
          <div className="sidebar-group__header">
            <p className="sidebar-group__label">Week</p>
          </div>
          <div className="sidebar-group__stack">
            {weekLinks.map((item) => {
              if (item.href) {
                const active = isActiveRoute(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="sidebar-item"
                    onClick={handleClose}
                    aria-current={active ? "page" : undefined}
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
                >
                  <SidebarRow label={item.label} icon={item.icon} />
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <nav className="sidebar-mobile-dock" aria-label="Hauptnavigation">
        {mobileDockNav.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={active ? "sidebar-mobile-dock__item sidebar-mobile-dock__item--active" : "sidebar-mobile-dock__item"}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

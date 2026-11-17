"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarCheck2,
  CalendarRange,
  ClipboardList,
  House,
  Settings2,
  type LucideIcon,
} from "lucide-react";

interface Page {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PAGES: Page[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/week", label: "Weekly planning", icon: CalendarRange },
  { href: "/backlog", label: "Backlog", icon: ClipboardList },
  { href: "/planning", label: "Daily planning", icon: CalendarCheck2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

const STORAGE_KEY = "page-switcher-recent";
/** A quick Ctrl+Tab tap switches straight away; the list only shows while Ctrl is held. */
const SHOW_DELAY_MS = 140;

function pageFor(pathname: string) {
  if (pathname === "/") return "/";
  return PAGES.find((page) => page.href !== "/" && (pathname === page.href || pathname.startsWith(`${page.href}/`)))
    ?.href;
}

function readRecent(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((href) => PAGES.some((page) => page.href === href)) : [];
  } catch {
    return [];
  }
}

/** Most recently used first, then the pages never opened in their sidebar order. */
function orderPages(recent: string[]) {
  const known = recent.map((href) => PAGES.find((page) => page.href === href)!).filter(Boolean);
  return [...known, ...PAGES.filter((page) => !recent.includes(page.href))];
}

/**
 * Ctrl+Tab switches between pages in most-recently-used order, like switching apps:
 * tap once for the previous page, keep Ctrl held and press Tab again to go further back
 * (Shift+Tab goes forward), release Ctrl to open the highlighted page, Esc cancels.
 */
export default function PageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const recentRef = useRef<string[]>([]);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);
  const stateRef = useRef({ open: false, index: 0, items: [] as Page[] });
  const showTimer = useRef<number | null>(null);

  // Remember the order in which pages were opened.
  useEffect(() => {
    const current = pageFor(pathname);
    if (!current) return;
    const recent = [current, ...readRecent().filter((href) => href !== current)];
    recentRef.current = recent;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Without storage the order is still kept for this visit.
    }
  }, [pathname]);

  useEffect(() => {
    function update(next: Partial<typeof stateRef.current>) {
      stateRef.current = { ...stateRef.current, ...next };
      if (next.open !== undefined) setOpen(next.open);
      if (next.index !== undefined) setIndex(next.index);
      if (next.items !== undefined) setItems(next.items);
    }

    function close() {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      showTimer.current = null;
      setVisible(false);
      update({ open: false });
    }

    function commit() {
      const target = stateRef.current.items[stateRef.current.index];
      close();
      if (target && target.href !== pageFor(window.location.pathname)) router.push(target.href);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const state = stateRef.current;

      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (!state.open) {
          const ordered = orderPages(recentRef.current.length ? recentRef.current : readRecent());
          update({ open: true, items: ordered, index: event.shiftKey ? ordered.length - 1 : 1 });
          showTimer.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        } else {
          const count = state.items.length;
          update({ index: (state.index + (event.shiftKey ? -1 : 1) + count) % count });
        }
        return;
      }

      if (!state.open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commit();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        const count = state.items.length;
        update({ index: (state.index + (event.key === "ArrowRight" ? 1 : -1) + count) % count });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (stateRef.current.open && event.key === "Control") commit();
    }

    // Switching windows while Ctrl is held would otherwise leave the list stuck open.
    function handleBlur() {
      if (stateRef.current.open) close();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
      if (showTimer.current) window.clearTimeout(showTimer.current);
    };
  }, [router]);

  const current = pageFor(pathname);

  return (
    <AnimatePresence>
      {open && visible && (
        <motion.div
          className="page-switcher"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            className="page-switcher__panel"
            role="listbox"
            aria-label="Seite wechseln"
            initial={{ scale: 0.96, y: 6 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          >
            {items.map((page, itemIndex) => {
              const Icon = page.icon;
              const active = itemIndex === index;
              return (
                <button
                  key={page.href}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`page-switcher__item${active ? " is-active" : ""}`}
                  onMouseEnter={() => {
                    stateRef.current.index = itemIndex;
                    setIndex(itemIndex);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    stateRef.current = { ...stateRef.current, open: false };
                    setVisible(false);
                    setOpen(false);
                    if (page.href !== current) router.push(page.href);
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="page-switcher-highlight"
                      className="page-switcher__highlight"
                      transition={{ type: "spring", stiffness: 600, damping: 40 }}
                    />
                  )}
                  <Icon size={22} strokeWidth={1.8} className="page-switcher__icon" />
                  <span className="page-switcher__label">{page.label}</span>
                  {page.href === current && <span className="page-switcher__here">offen</span>}
                </button>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ThemeMode } from "@/types";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const SETTINGS_STORAGE_KEY = "sunsama-settings-v1";

export function resolveDarkMode(themeMode: ThemeMode) {
  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Runs before the first paint so a dark theme never flashes light.
 * Reads the persisted settings directly because the store is not hydrated yet.
 */
export const themeInitScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  SETTINGS_STORAGE_KEY
)});var mode=raw&&JSON.parse(raw).state.settings.display.themeMode||"system";var dark=mode==="dark"||(mode==="system"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

/** Keeps the `dark` class on <html> in sync with the theme setting and the OS. */
export default function ThemeSync() {
  const themeMode = useSettingsStore((state) => state.settings.display.themeMode);
  const hydrated = useSettingsStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) return undefined;

    const html = document.documentElement;
    const apply = () => html.classList.toggle("dark", resolveDarkMode(themeMode));
    apply();

    if (themeMode !== "system") return undefined;

    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, themeMode]);

  return null;
}

/** Flips between light and dark (used by Shift+L), starting from what is visible now. */
export function toggleThemeMode() {
  const { settings, updateSection } = useSettingsStore.getState();
  const html = document.documentElement;
  const nextMode: ThemeMode = resolveDarkMode(settings.display.themeMode) ? "light" : "dark";

  html.classList.add("theme-transition");
  updateSection("display", { themeMode: nextMode });
  window.setTimeout(() => html.classList.remove("theme-transition"), 450);
}

/**
 * Haptic feedback in the iPhone app (ios/PlanungSync, WebAppView.swift). In a
 * normal browser and in the Mac app there is no "planung" bridge, so this does nothing.
 *
 * - select:  a value changed (day switched, card selected)
 * - light:   small confirmation (task reopened, delete armed, card dropped)
 * - medium:  something was created or picked up (task added, drag started)
 * - success: something was finished (task done, planned, day closed)
 * - warning: something was removed (task deleted)
 */
export type HapticKind = "select" | "light" | "medium" | "success" | "warning";

export function haptic(kind: HapticKind) {
  if (typeof window === "undefined") return;
  const bridge = (window as unknown as {
    webkit?: { messageHandlers?: { planung?: { postMessage: (message: string) => void } } };
  }).webkit?.messageHandlers?.planung;
  bridge?.postMessage(`haptic:${kind}`);
}

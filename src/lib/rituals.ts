/** The automatic Feierabend prompt, shown once a day across all devices. */
export const SHUTDOWN_PROMPT_RITUAL = "shutdown";

/**
 * Claims a once-a-day ritual for the whole account. Resolves true when this
 * device is the first that day. Offline or on server errors it resolves true,
 * so the prompt still works locally (each device then asks at most once).
 */
export async function claimDailyRitual(date: string, type: string): Promise<boolean> {
  try {
    const response = await fetch("/api/rituals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type }),
    });
    if (!response.ok) return true;
    const result = (await response.json()) as { claimed?: boolean };
    return result.claimed !== false;
  } catch {
    return true;
  }
}

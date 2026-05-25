import "server-only";

// Fires a Pushcut webhook so the iOS Scriptable widget refreshes within seconds
// instead of waiting on iOS WidgetKit's own (much slower) refresh budget.
//
// Setup:
//   1. In Pushcut iOS app: create a Notification (e.g. "Sunsama Refresh") with
//      an Action "Run Script" → "sunsama-today" (Scriptable script name).
//      Copy the notification's Webhook URL.
//   2. Set PUSHCUT_WEBHOOK_URL in .env / Vercel env to that URL.
//
// Without PUSHCUT_WEBHOOK_URL set, this is a no-op — safe to call always.

const WEBHOOK_TIMEOUT_MS = 1500;

export async function notifyPushcut(payload: {
  title?: string;
  text?: string;
  input?: string;
}): Promise<void> {
  const url = process.env.PUSHCUT_WEBHOOK_URL;
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title ?? "Sunsama",
        text: payload.text ?? "Tasks aktualisiert",
        input: payload.input,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[pushcut] webhook returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[pushcut] webhook failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}

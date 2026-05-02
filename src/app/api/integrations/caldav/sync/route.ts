import { requireUserId } from "@/lib/server-auth";
import { runSync } from "@/lib/caldav-sync";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runSync(userId);
    return Response.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync fehlgeschlagen.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

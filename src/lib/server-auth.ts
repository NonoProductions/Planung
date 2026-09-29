import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Session user ID -> app user ID ("User".id), resolved once per server process.
const resolvedUserIds = new Map<string, string>();

/**
 * Maps the session to a row in the public "User" table.
 * A session can outlive its user row (e.g. the Supabase Auth account was
 * recreated), which would make every insert fail on the userId foreign key.
 * In that case the user is looked up by email, or created as a last resort.
 */
async function resolveAppUserId(sessionUserId: string, email?: string | null, name?: string | null) {
  const cached = resolvedUserIds.get(sessionUserId);
  if (cached) return cached;

  try {
    const { data: byId } = await supabase
      .from("User")
      .select("id")
      .eq("id", sessionUserId)
      .maybeSingle();

    let appUserId = byId?.id as string | undefined;

    if (!appUserId && email) {
      const { data: byEmail } = await supabase
        .from("User")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      appUserId = byEmail?.id as string | undefined;

      if (!appUserId) {
        const { error } = await supabase.from("User").insert({
          id: sessionUserId,
          email,
          name: name ?? email.split("@")[0],
        });
        if (!error) appUserId = sessionUserId;
      }
    }

    if (!appUserId) return sessionUserId;

    resolvedUserIds.set(sessionUserId, appUserId);
    return appUserId;
  } catch {
    // Database unavailable: keep the session ID so routes can use their fallbacks.
    return sessionUserId;
  }
}

/**
 * Returns the authenticated user's ID, or null if not authenticated.
 * Use in API route handlers for defense-in-depth (middleware is the primary gate).
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return null;

  return resolveAppUserId(sessionUserId, session.user?.email, session.user?.name);
}

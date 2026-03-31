import { auth } from "@/lib/auth";

/**
 * Returns the authenticated user's ID, or null if not authenticated.
 * Use in API route handlers for defense-in-depth (middleware is the primary gate).
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

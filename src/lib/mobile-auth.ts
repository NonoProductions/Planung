import { createClient, type Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Bearer-token auth for the iOS sync app. The app signs in once via
 * /api/mobile/login and then sends the Supabase access token with every request.
 */

// Fresh anon client per call so a signed-in session never leaks into the
// shared service-role client used by the API routes.
function createAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function toMobileSession(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    email: session.user.email ?? null,
  };
}

export async function signInForMobile(email: string, password: string) {
  const authClient = createAuthClient();
  if (!authClient) return null;

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return toMobileSession(data.session);
}

export async function refreshForMobile(refreshToken: string) {
  const authClient = createAuthClient();
  if (!authClient) return null;

  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  return toMobileSession(data.session);
}

type BearerUser = { id: string; email?: string; name?: string };

// Access token -> Supabase Auth user, so a sync run doesn't verify the token once per request.
const verifiedTokens = new Map<string, { user: BearerUser; until: number }>();
const TOKEN_CACHE_MS = 5 * 60 * 1000;

export async function verifyBearerToken(token: string): Promise<BearerUser | null> {
  const cached = verifiedTokens.get(token);
  if (cached && cached.until > Date.now()) return cached.user;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user: BearerUser = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.user_metadata?.name as string | undefined,
  };
  if (verifiedTokens.size > 500) verifiedTokens.clear();
  verifiedTokens.set(token, { user, until: Date.now() + TOKEN_CACHE_MS });
  return user;
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Verifies email + password against Supabase Auth and returns the app user.
 * The app user is the row in the public "User" table with the same email;
 * if none exists yet, one is created with the Supabase Auth user ID.
 */
async function authorizeWithSupabase(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  // Fresh client per login so the signed-in session never leaks into the
  // shared service-role client used by the API routes.
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  const authUser = data.user;
  const userEmail = authUser.email ?? email;
  const name =
    (authUser.user_metadata?.name as string | undefined) ?? userEmail.split("@")[0];

  const { data: existing, error: lookupError } = await supabase
    .from("User")
    .select("id")
    .ilike("email", userEmail)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    return { id: existing.id as string, name, email: userEmail };
  }

  // Tasks, channels etc. reference "User".id, so the row must exist before login succeeds.
  const { error: insertError } = await supabase.from("User").insert({
    id: authUser.id,
    email: userEmail,
    name,
  });
  if (insertError) throw insertError;

  return { id: authUser.id, name, email: userEmail };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;
        if (!email || !password) return null;

        return authorizeWithSupabase(email.trim(), password);
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
});

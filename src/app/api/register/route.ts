import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { getSupabaseClient } from "@/lib/supabase";

const DEMO_USER_ID = "demo-user-001";

const TABLES_WITH_USER_DATA = [
  "Task",
  "Channel",
  "Objective",
  "CalendarEvent",
  "CalendarCategory",
  "Reflection",
  "TimeEntry",
] as const;

async function migrateDemoData(supabase: ReturnType<typeof getSupabaseClient>, newUserId: string) {
  // Check if this is the very first real user
  const { count } = await supabase
    .from("User")
    .select("id", { count: "exact", head: true });

  // Only migrate if this is the first user (count is 1 because we just inserted them)
  if (count !== 1) return;

  // Migrate all demo-user data to the new user
  for (const table of TABLES_WITH_USER_DATA) {
    await supabase
      .from(table)
      .update({ userId: newUserId })
      .eq("userId", DEMO_USER_ID);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !password) {
    return Response.json({ error: "Email und Passwort sind erforderlich" }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from("User")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);

  const { data: user, error } = await supabase
    .from("User")
    .insert({ email, name: name || null, password: passwordHash })
    .select("id, email, name")
    .single();

  if (error) {
    return Response.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }

  await migrateDemoData(supabase, user.id);

  return Response.json(user, { status: 201 });
}

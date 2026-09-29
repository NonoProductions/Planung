"use client";

import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const callbackUrl =
      typeof window === "undefined"
        ? "/"
        : new URLSearchParams(window.location.search).get("callbackUrl") || "/";

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("E-Mail oder Passwort ist falsch.");
    } else {
      router.replace(callbackUrl);
      router.refresh();
    }
  }

  return (
    <main className="login-page">
      <header className="login-page__bar">
        <span className="login-page__brand">Noes Planer</span>
      </header>

      <div className="login-page__center">
        <section className="login-card">
          <h1 className="login-card__title">Anmelden</h1>
          <p className="login-card__copy">
            Melde dich an, um deinen Tag zu planen.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span className="login-field__label">E-Mail</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="du@beispiel.de"
                className="workspace-input"
              />
            </label>

            <label className="login-field">
              <span className="login-field__label">Passwort</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="workspace-input"
              />
            </label>

            {error && (
              <p className="login-error" role="alert">
                <CircleAlert size={16} strokeWidth={2.2} />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="workspace-button workspace-button--primary login-submit"
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" />
                  Wird angemeldet…
                </>
              ) : (
                <>
                  Anmelden
                  <ArrowRight size={16} strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

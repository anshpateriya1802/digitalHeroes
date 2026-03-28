"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface LoginResult {
  user?: {
    id: string;
    role: "subscriber" | "admin";
  };
  error?: string;
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ava@example.com");
  const [password, setPassword] = useState("ava12345");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as LoginResult;

      if (!response.ok || !data.user) {
        setError(data.error ?? "Unable to sign in.");
        return;
      }

      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const destination = next && next.startsWith("/") ? next : data.user.role === "admin" ? "/admin" : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unexpected error while signing in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid-fade flex min-h-screen items-center justify-center px-6 py-10">
      <main className="hero-glass w-full max-w-md rounded-3xl p-8">
        <p className="chip chip-brand inline-block">Authentication</p>
        <h1 className="mt-4 text-3xl font-bold">Sign in to Drive for Good</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use your account credentials. New users can create an account from the sign-up page.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
            placeholder="you@example.com"
          />

          <label className="block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
            placeholder="••••••••"
          />

          {error ? <p className="text-sm text-[#9f2f2f]">{error}</p> : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-sm">
            <Link className="font-semibold text-[var(--brand)]" href="/auth/forgot-password">
              Forgot password?
            </Link>
          </p>
        </form>

        <p className="mt-4 text-sm text-[var(--muted)]">
          New here?{" "}
          <Link className="font-semibold text-[var(--brand)]" href="/auth/sign-up">
            Create an account
          </Link>
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--card-border)] bg-white/80 p-4 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--ink)]">Demo accounts</p>
          <p className="mt-1">Subscriber: ava@example.com / ava12345</p>
        </div>
      </main>
    </div>
  );
}

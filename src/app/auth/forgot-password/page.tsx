"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "request" | "reset";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get("context") === "admin";

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [adminId, setAdminId] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAdmin
            ? { context: "admin", adminId }
            : { context: "subscriber", email },
        ),
      });

      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to send code.");
        return;
      }

      setInfo(data.message ?? "Check your email for the sign-in code.");
      setStep("reset");
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAdmin
            ? { context: "admin", adminId, token, password }
            : { context: "subscriber", email, token, password },
        ),
      });

      const data = (await response.json()) as {
        user?: { id: string; role: "subscriber" | "admin" };
        error?: string;
      };

      if (!response.ok || !data.user) {
        setError(data.error ?? "Unable to reset password.");
        return;
      }

      const destination = data.user.role === "admin" ? "/admin" : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid-fade flex min-h-screen items-center justify-center px-6 py-10">
      <main className="hero-glass w-full max-w-md rounded-3xl p-8">
        <p className="chip chip-brand inline-block">Password reset</p>
        <h1 className="mt-4 text-3xl font-bold">
          {isAdmin ? "Reset admin password" : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {step === "request"
            ? isAdmin
              ? "We will email a one-time code to the address linked to your admin ID."
              : "We will email a one-time code to your account email."
            : "Enter the code from your email and choose a new password."}
        </p>

        {step === "request" ? (
          <form className="mt-6 space-y-4" onSubmit={onRequestCode}>
            {isAdmin ? (
              <>
                <label className="block text-sm font-medium" htmlFor="adminId">
                  Admin ID
                </label>
                <input
                  id="adminId"
                  type="text"
                  required
                  value={adminId}
                  onChange={(event) => setAdminId(event.target.value.toLowerCase())}
                  className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
                  placeholder="admin-root"
                  autoComplete="username"
                />
              </>
            ) : (
              <>
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
                  autoComplete="email"
                />
              </>
            )}

            {error ? <p className="text-sm text-[#9f2f2f]">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onResetPassword}>
            <label className="block text-sm font-medium" htmlFor="token">
              Code from email
            </label>
            <input
              id="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={token}
              onChange={(event) => setToken(event.target.value.trim())}
              className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm tracking-widest"
              placeholder="6-digit code"
            />

            <label className="block text-sm font-medium" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />

            <label className="block text-sm font-medium" htmlFor="confirm">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="w-full rounded-xl border border-[var(--card-border)] bg-white px-4 py-3 text-sm"
              placeholder="Repeat password"
              autoComplete="new-password"
            />

            {error ? <p className="text-sm text-[#9f2f2f]">{error}</p> : null}
            {info ? <p className="text-sm text-[var(--muted)]">{info}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Updating…" : "Update password & sign in"}
            </button>

            <button
              type="button"
              className="w-full text-sm font-semibold text-[var(--brand)]"
              onClick={() => {
                setStep("request");
                setToken("");
                setPassword("");
                setConfirm("");
                setError(null);
                setInfo(null);
              }}
            >
              ← Back to send another code
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-[var(--muted)]">
          {isAdmin ? (
            <>
              <Link className="font-semibold text-[var(--brand)]" href="/control-room">
                Back to admin sign-in
              </Link>
            </>
          ) : (
            <>
              <Link className="font-semibold text-[var(--brand)]" href="/auth/sign-in">
                Back to sign in
              </Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid-fade flex min-h-screen items-center justify-center px-6 py-10">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}

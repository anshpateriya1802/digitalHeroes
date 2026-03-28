import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/components/logout-button";
import { SubscriberActions } from "@/app/components/subscriber-actions";
import { getSessionFromRequest, getUserFromSessionDb } from "@/lib/auth";
import { getSubscriberDashboardDb, listCharities } from "@/lib/data";
import { NextRequest } from "next/server";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const fakeRequest = {
    cookies: {
      get: (name: string) => {
        const value = cookieStore.get(name)?.value;
        return value ? { value } : undefined;
      },
    },
  } as unknown as NextRequest;

  const session = getSessionFromRequest(fakeRequest);
  const user = await getUserFromSessionDb(session);

  if (!session || !user || (session.role !== "subscriber" && session.role !== "admin")) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  const data = await getSubscriberDashboardDb(user.id);
  const charities = await listCharities();

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="hero-glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="chip chip-brand inline-block">Subscriber Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold">Welcome back, {user.name}</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Track performance, manage charity impact, and monitor draw participation.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="rounded-full border border-[var(--card-border)] bg-white px-5 py-2 text-sm font-semibold">
                Back to Home
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Subscription</h2>
            <p className="mt-2 text-2xl font-bold capitalize">{data.user.subscription.status}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Renews {new Date(data.user.subscription.renewalDate).toLocaleDateString()}</p>
          </article>
          <article className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Plan</h2>
            <p className="mt-2 text-2xl font-bold capitalize">{data.user.subscription.plan}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">${data.user.subscription.amount} billed</p>
          </article>
          <article className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Draw Entries</h2>
            <p className="mt-2 text-2xl font-bold">{data.participationCount}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Total participation records</p>
          </article>
          <article className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Winning Entries</h2>
            <p className="mt-2 text-2xl font-bold">{data.winningsCount}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">3+ match outcomes</p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="card p-6">
            <h2 className="text-xl font-semibold">Latest 5 Scores (Stableford)</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Most recent first. New entries replace oldest automatically.</p>
            <ul className="mt-4 space-y-2">
              {data.scores.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between rounded-xl border border-[var(--card-border)] px-4 py-3">
                  <span className="text-sm text-[var(--muted)]">{new Date(entry.playedAt).toLocaleDateString()}</span>
                  <span className="text-lg font-bold">{entry.score}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card p-6">
            <h2 className="text-xl font-semibold">Charity Selection</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Selected charity and contribution percentage.</p>
            <p className="mt-4 text-2xl font-bold">{data.charity?.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Contribution: {data.user.subscription.charityPercent}%</p>
            <p className="mt-4 text-sm text-[var(--muted)]">{data.charity?.description}</p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="card p-6">
            <h2 className="text-xl font-semibold">Participation Summary</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Draws entered and current month draw state.</p>
            <div className="mt-4 rounded-xl border border-[var(--card-border)] p-4">
              <p className="text-sm text-[var(--muted)]">Current Month</p>
              <p className="text-lg font-semibold">{data.latestDraw?.draw.monthKey ?? "No draw yet"}</p>
              {data.latestDraw?.draw.id ? (
                <p className="mt-1 text-sm text-[var(--muted)]">Draw ID: {data.latestDraw.draw.id}</p>
              ) : null}
              <p className="mt-2 text-sm text-[var(--muted)]">
                Draw numbers: {data.latestDraw?.draw.numbers.join(", ") ?? "Pending"}
              </p>
            </div>
          </article>

          <article className="card p-6">
            <h2 className="text-xl font-semibold">Winnings & Payment Status</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Verification and payout tracking.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {data.claims.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--card-border)] p-3 text-[var(--muted)]">
                  No claims submitted yet.
                </li>
              ) : (
                data.claims.map((claim) => (
                  <li key={claim.id} className="rounded-xl border border-[var(--card-border)] p-3">
                    Claim {claim.id}: {claim.claimStatus} / {claim.payoutStatus}
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <SubscriberActions
          currentPlan={data.user.subscription.plan}
          currentStatus={data.user.subscription.status}
          currentCharityId={data.user.charityId}
          currentCharityPercent={data.user.subscription.charityPercent}
          charities={charities.map((entry) => ({ id: entry.id, name: entry.name }))}
          latestDraw={data.latestDraw}
          claimableEntries={data.claimableEntries}
          drawHistory={data.drawHistory}
          latestUserDrawEntry={data.latestUserDrawEntry}
        />
      </div>
    </div>
  );
}
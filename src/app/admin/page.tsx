import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/components/logout-button";
import { AdminDashboard } from "@/app/components/admin-dashboard";
import { getSessionFromRequest, getUserFromSessionDb } from "@/lib/auth";
import { getAdminDashboardDb } from "@/lib/data";
import { NextRequest } from "next/server";

export default async function AdminPage() {
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

  if (!session || !user || session.role !== "admin") {
    redirect("/auth/sign-in?next=/admin");
  }

  const data = await getAdminDashboardDb();

  return (
    <div className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="hero-glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="chip chip-accent inline-block">Administrator</p>
              <h1 className="mt-3 text-3xl font-bold">Control Center</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Manage users, subscriptions, draw operations, charities, and winner verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="rounded-full border border-[var(--card-border)] bg-white px-5 py-2 text-sm font-semibold">
                Back to Home
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-5">
          <article className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total Users</p>
            <p className="mt-2 text-3xl font-bold">{data.totals.users}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Active Subs</p>
            <p className="mt-2 text-3xl font-bold">{data.totals.activeSubscribers}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Prize Pool</p>
            <p className="mt-2 text-3xl font-bold">₹{data.totals.totalPrizePool}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Charities</p>
            <p className="mt-2 text-3xl font-bold">{data.totals.charities}</p>
          </article>
          <article className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Claims</p>
            <p className="mt-2 text-3xl font-bold">{data.totals.claims}</p>
          </article>
        </section>

        <AdminDashboard initialUsers={data.users} />
      </div>
    </div>
  );
}
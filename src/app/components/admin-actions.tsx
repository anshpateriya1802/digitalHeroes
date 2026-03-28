"use client";

import { FormEvent, useState } from "react";
import { Plan, SubscriptionStatus } from "@/lib/types";

type DrawMode = "random" | "algorithmic";

interface Subscriber {
  id: string;
  name: string;
  email: string;
  subscription: {
    plan: Plan;
    status: SubscriptionStatus;
  };
}

interface AdminActionsProps {
  initialSubscribers: Subscriber[];
}

interface DrawRunResult {
  draw: {
    monthKey: string;
    mode: DrawMode;
    numbers: number[];
  };
  entries: Array<{ id: string }>;
}

export function AdminActions({ initialSubscribers }: AdminActionsProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(initialSubscribers);
  const [selectedUserId, setSelectedUserId] = useState(initialSubscribers[0]?.id ?? "");
  const [plan, setPlan] = useState<Plan>(initialSubscribers[0]?.subscription.plan ?? "monthly");
  const [status, setStatus] = useState<SubscriptionStatus>(
    initialSubscribers[0]?.subscription.status ?? "active"
  );
  const [drawMode, setDrawMode] = useState<DrawMode>("random");
  const [score, setScore] = useState("30");
  const [playedAt, setPlayedAt] = useState("");
  const [charityName, setCharityName] = useState("");
  const [charityDescription, setCharityDescription] = useState("");
  const [claimId, setClaimId] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [drawResult, setDrawResult] = useState<DrawRunResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadSubscribers() {
    const response = await fetch("/api/admin/users");
    const data = (await response.json()) as { users?: Subscriber[]; error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to load subscribers.");
      return;
    }
    const nextUsers = data.users ?? [];
    setSubscribers(nextUsers);
    const selected = nextUsers.find((entry) => entry.id === selectedUserId) ?? nextUsers[0];
    if (selected) {
      setSelectedUserId(selected.id);
      setPlan(selected.subscription.plan);
      setStatus(selected.subscription.status);
    }
  }

  function handleSubscriberChange(nextUserId: string) {
    setSelectedUserId(nextUserId);
    const nextUser = subscribers.find((entry) => entry.id === nextUserId);
    if (nextUser) {
      setPlan(nextUser.subscription.plan);
      setStatus(nextUser.subscription.status);
    }
  }

  async function runDraw(action: "simulate" | "publish") {
    setFeedback(null);
    setDrawResult(null);

    try {
      const response = await fetch(`/api/draws/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: drawMode }),
      });

      const text = await response.text();
      const data = text ? (JSON.parse(text) as { error?: string; draw?: { monthKey: string; mode: DrawMode; numbers: number[] }; entries?: Array<{ id: string }> }) : {};

      if (!response.ok || !data.draw) {
        setFeedback(data.error ?? `Failed to ${action} draw.`);
        return;
      }

      setDrawResult({
        draw: {
          monthKey: data.draw.monthKey,
          mode: data.draw.mode,
          numbers: data.draw.numbers,
        },
        entries: data.entries ?? [],
      });
      setFeedback(`Draw ${action}d successfully for ${data.draw.monthKey}.`);
    } catch {
      setFeedback(`Failed to ${action} draw. Please try again.`);
    }
  }

  async function updateSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      setFeedback("Select a subscriber first.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, plan, status }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to update subscription.");
      return;
    }
    setFeedback("Subscriber subscription updated.");
    void loadSubscribers();
  }

  async function addScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      setFeedback("Select a subscriber first.");
      return;
    }

    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUserId,
        score: Number(score),
        playedAt,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to add score.");
      return;
    }
    setFeedback("Score added for selected subscriber.");
  }

  async function addCharity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/charities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: charityName,
        description: charityDescription,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to add charity.");
      return;
    }
    setCharityName("");
    setCharityDescription("");
    setFeedback("Charity created successfully.");
  }

  async function reviewClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        claimId,
        decision,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to review claim.");
      return;
    }
    setFeedback(`Claim ${decision}d successfully.`);
  }

  async function markClaimPaid() {
    const response = await fetch("/api/winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark-paid",
        claimId,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Failed to mark claim as paid.");
      return;
    }
    setFeedback("Claim marked as paid.");
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="card space-y-4 p-6">
        <h2 className="text-xl font-semibold">Draw Controls</h2>
        <label className="text-sm font-medium" htmlFor="drawMode">
          Draw Mode
        </label>
        <select
          id="drawMode"
          value={drawMode}
          onChange={(event) => setDrawMode(event.target.value as DrawMode)}
          className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="random">Random</option>
          <option value="algorithmic">Algorithmic</option>
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runDraw("simulate")}
            className="rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold"
          >
            Run Simulation
          </button>
          <button
            type="button"
            onClick={() => void runDraw("publish")}
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Publish Draw
          </button>
        </div>
      </article>

      <article className="card space-y-4 p-6">
        <h2 className="text-xl font-semibold">Subscriber Management</h2>
        <label className="text-sm font-medium" htmlFor="subscriber">
          Subscriber
        </label>
        <select
          id="subscriber"
          value={selectedUserId}
          onChange={(event) => handleSubscriberChange(event.target.value)}
          className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
        >
          {subscribers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.email})
            </option>
          ))}
        </select>

        <form className="grid gap-3" onSubmit={updateSubscription}>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value as Plan)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="lapsed">Lapsed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Update Subscription
          </button>
        </form>

        <form className="grid gap-3" onSubmit={addScore}>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              max={45}
              value={score}
              onChange={(event) => setScore(event.target.value)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              placeholder="Score"
            />
            <input
              type="date"
              value={playedAt}
              onChange={(event) => setPlayedAt(event.target.value)}
              className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <button className="rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold" type="submit">
            Add Score
          </button>
        </form>
      </article>

      {drawResult ? (
        <article className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold">Latest Draw Result</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {drawResult.draw.monthKey} • {drawResult.draw.mode} • {drawResult.entries.length} entries processed
          </p>
          <p className="mt-1 text-sm">
            Numbers: <span className="font-semibold">{drawResult.draw.numbers.join(", ")}</span>
          </p>
        </article>
      ) : null}

      <article className="card space-y-4 p-6">
        <h2 className="text-xl font-semibold">Charity Management</h2>
        <form className="grid gap-3" onSubmit={addCharity}>
          <input
            type="text"
            value={charityName}
            onChange={(event) => setCharityName(event.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            placeholder="Charity name"
            required
          />
          <textarea
            value={charityDescription}
            onChange={(event) => setCharityDescription(event.target.value)}
            className="min-h-24 rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            placeholder="Charity description"
            required
          />
          <button className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Add Charity
          </button>
        </form>
      </article>

      <article className="card space-y-4 p-6">
        <h2 className="text-xl font-semibold">Winner Verification & Payouts</h2>
        <form className="grid gap-3" onSubmit={reviewClaim}>
          <input
            type="text"
            value={claimId}
            onChange={(event) => setClaimId(event.target.value)}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            placeholder="Claim ID"
            required
          />
          <select
            value={decision}
            onChange={(event) => setDecision(event.target.value as "approve" | "reject")}
            className="rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
          <button className="rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold" type="submit">
            Submit Decision
          </button>
          <button
            type="button"
            onClick={() => void markClaimPaid()}
            className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Mark Claim Paid
          </button>
        </form>
      </article>

      {feedback ? (
        <p className="lg:col-span-2 rounded-xl border border-[var(--card-border)] bg-white p-3 text-sm">{feedback}</p>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { SubscriptionStatus, Plan } from "@/lib/types";

interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  renewalDate?: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    fullName: string;
    email: string;
  };
}

export function SubscriptionManagementPanel() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"active" | "inactive" | "lapsed" | "canceled" | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  async function loadSubscriptions() {
    setLoading(true);
    const status = filter === "all" ? "" : filter;
    const url = status ? `/api/admin/subscriptions?status=${status}` : "/api/admin/subscriptions";
    const response = await fetch(url);
    const data = (await response.json()) as { subscriptions?: Subscription[]; error?: string };
    if (response.ok) {
      setSubscriptions(data.subscriptions ?? []);
    }
    setLoading(false);
  }

  async function updateSubscription(subId: string, updates: Record<string, unknown>) {
    setFeedback(null);
    const response = await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: subId,
        ...updates,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (response.ok) {
      setFeedback("Subscription updated successfully.");
      void loadSubscriptions();
      setEditing(null);
    } else {
      setFeedback(data.error ?? "Failed to update subscription.");
    }
  }

  const editingData = subscriptions.find((s) => s.id === editing);
  const filtered = filter === "all" ? subscriptions : subscriptions.filter((s) => s.status === filter);

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-xl font-semibold">Subscription Management</h2>

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "active", "inactive", "lapsed", "canceled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === s
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--card-border)] bg-white"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({filtered.length})
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          feedback.includes("successfully")
            ? "bg-green-50 text-green-900"
            : "bg-red-50 text-red-900"
        }`}>
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No subscriptions found.</p>
      ) : editing && editingData ? (
        <div className="space-y-4 rounded-xl border border-[var(--card-border)] p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{editingData.user.fullName}</p>
              <p className="text-sm text-[var(--muted)]">{editingData.user.email}</p>
            </div>
            <button
              onClick={() => setEditing(null)}
              className="text-2xl font-bold text-[var(--muted)]"
            >
              ×
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const updates: Record<string, unknown> = {};
              const planSelect = (e.currentTarget.elements.namedItem("plan") as HTMLSelectElement)?.value;
              const statusSelect = (e.currentTarget.elements.namedItem("status") as HTMLSelectElement)?.value;
              if (planSelect && planSelect !== editingData.plan) updates.plan = planSelect;
              if (statusSelect && statusSelect !== editingData.status) updates.status = statusSelect;
              void updateSubscription(editing, updates);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-sm font-medium">Plan</label>
              <select
                name="plan"
                defaultValue={editingData.plan}
                className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                name="status"
                defaultValue={editingData.status}
                className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="lapsed">Lapsed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                defaultValue={editingData.amount}
                className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
              />
            </div>

            {editingData.renewalDate && (
              <p className="text-xs text-[var(--muted)]">
                Renewal: {new Date(editingData.renewalDate).toLocaleDateString()}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded-full border border-[var(--card-border)] bg-white px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((sub) => (
            <li
              key={sub.id}
              className="rounded-xl border border-[var(--card-border)] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{sub.user.fullName}</p>
                  <p className="text-xs text-[var(--muted)]">{sub.user.email}</p>
                  <div className="mt-1 flex gap-2 text-xs">
                    <span>
                      <strong>Plan:</strong> {sub.plan === "monthly" ? "₹29/mo" : "₹290/yr"}
                    </span>
                    <span>
                      <strong>Created:</strong> {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    sub.status === "active"
                      ? "bg-green-100 text-green-900"
                      : sub.status === "inactive"
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        : sub.status === "lapsed"
                          ? "bg-yellow-100 text-yellow-900"
                          : "bg-red-100 text-red-900"
                  }`}>
                    {sub.status}
                  </span>
                  <button
                    onClick={() => setEditing(sub.id)}
                    className="rounded-full border border-[var(--card-border)] bg-white px-3 py-1 text-xs font-semibold"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

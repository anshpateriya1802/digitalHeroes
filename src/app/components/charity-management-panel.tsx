"use client";

import { useEffect, useState } from "react";

interface Charity {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  featured: boolean;
  active: boolean;
}

export function CharityManagementPanel() {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadCharities();
  }, []);

  async function loadCharities() {
    setLoading(true);
    const response = await fetch("/api/charities");
    const data = (await response.json()) as { charities?: Charity[]; error?: string };
    if (response.ok) {
      setCharities(data.charities ?? []);
    }
    setLoading(false);
  }

  async function createCharity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);

    if (!formData.name || !formData.description) {
      setFeedback("Name and description are required.");
      return;
    }

    const response = await fetch("/api/charities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: formData.name,
        description: formData.description,
      }),
    });

    const data = (await response.json()) as { charity?: Charity; error?: string };
    if (response.ok) {
      setFeedback("Charity created successfully.");
      setFormData({ name: "", description: "" });
      void loadCharities();
    } else {
      setFeedback(data.error ?? "Failed to create charity.");
    }
  }

  async function updateCharity(charityId: string, updates: Record<string, unknown>) {
    setFeedback(null);
    const response = await fetch("/api/charities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        charityId,
        ...updates,
      }),
    });

    const data = (await response.json()) as { charity?: Charity; error?: string };
    if (response.ok) {
      setFeedback("Charity updated successfully.");
      void loadCharities();
      setEditing(null);
    } else {
      setFeedback(data.error ?? "Failed to update charity.");
    }
  }

  async function deleteCharity(charityId: string) {
    if (!confirm("Are you sure you want to delete this charity?")) return;

    setFeedback(null);
    const response = await fetch("/api/charities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        charityId,
      }),
    });

    if (response.ok) {
      setFeedback("Charity deleted successfully.");
      void loadCharities();
    } else {
      const data = (await response.json()) as { error?: string };
      setFeedback(data.error ?? "Failed to delete charity.");
    }
  }

  const editingCharity = charities.find((c) => c.id === editing);

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h2 className="text-xl font-semibold">Create New Charity</h2>
        <form onSubmit={createCharity} className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Charity name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            required
          />
          <textarea
            placeholder="Charity description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="min-h-24 w-full rounded-xl border border-[var(--card-border)] bg-white px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Create Charity
          </button>
        </form>
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

      <div className="card p-6">
        <h2 className="text-xl font-semibold">Charities ({charities.length})</h2>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading...</p>
        ) : charities.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No charities yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {charities.map((charity) => (
              <li
                key={charity.id}
                className="rounded-xl border border-[var(--card-border)] p-4"
              >
                {editing === charity.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const updates: Record<string, unknown> = {};
                      const nameInput = (e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value;
                      const descInput = (e.currentTarget.elements.namedItem("description") as HTMLTextAreaElement)?.value;
                      if (nameInput && nameInput !== charity.name) updates.name = nameInput;
                      if (descInput && descInput !== charity.description) updates.description = descInput;
                      void updateCharity(charity.id, updates);
                    }}
                    className="space-y-2"
                  >
                    <input
                      name="name"
                      type="text"
                      defaultValue={charity.name}
                      className="w-full rounded-lg border border-[var(--card-border)] bg-white px-2 py-1 text-sm"
                    />
                    <textarea
                      name="description"
                      defaultValue={charity.description}
                      className="min-h-16 w-full rounded-lg border border-[var(--card-border)] bg-white px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="flex-1 rounded-full border border-[var(--card-border)] bg-white px-3 py-1 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{charity.name}</p>
                      <p className="text-sm text-[var(--muted)]">{charity.description}</p>
                      <div className="mt-2 flex gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          charity.active
                            ? "bg-green-100 text-green-900"
                            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                        }`}>
                          {charity.active ? "Active" : "Inactive"}
                        </span>
                        {charity.featured && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(charity.id)}
                        className="rounded-full border border-[var(--card-border)] bg-white px-3 py-1 text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteCharity(charity.id)}
                        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

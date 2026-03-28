"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type UserRole = "subscriber" | "admin";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface AdminAccessRequest {
  id: string;
  requestedByUserId: string;
  adminId: string;
  fullName: string;
  status: string;
  createdAt: string;
  requestedBy: {
    name: string;
    email: string;
  };
}

export function AdminUserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("subscriber");
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("System Admin");
  const [submittingAdminRequest, setSubmittingAdminRequest] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/users?scope=all");
    const data = (await response.json()) as { users?: ManagedUser[]; error?: string };

    if (!response.ok) {
      setFeedback(data.error ?? "Unable to load users.");
      setLoading(false);
      return;
    }

    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  const loadAdminRequests = useCallback(async () => {
    setLoadingRequests(true);
    const response = await fetch("/api/admin/users?scope=admin-requests");
    const data = (await response.json()) as {
      requests?: AdminAccessRequest[];
      error?: string;
    };

    if (!response.ok) {
      setFeedback(data.error ?? "Unable to load admin requests.");
      setLoadingRequests(false);
      return;
    }

    setRequests((data.requests ?? []).filter((entry) => entry.status === "pending"));
    setLoadingRequests(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
    void loadAdminRequests();
  }, [loadUsers, loadAdminRequests]);

  function openEdit(user: ManagedUser) {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setFeedback(null);
  }

  function closeEdit() {
    setEditingUserId(null);
    setEditName("");
    setEditEmail("");
    setEditRole("subscriber");
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUserId) return;

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUserId,
        name: editName,
        email: editEmail,
        role: editRole,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Unable to update user.");
      return;
    }

    setFeedback("User updated successfully.");
    closeEdit();
    await loadUsers();
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm("Are you sure you want to remove this user? This action is permanent.");
    if (!confirmed) return;

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback(data.error ?? "Unable to remove user.");
      return;
    }

    setFeedback("User removed successfully.");
    if (editingUserId === userId) {
      closeEdit();
    }
    await loadUsers();
  }

  async function createAdminRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAdminRequest(true);
    setFeedback(null);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-admin-request",
        adminId: newAdminId,
        fullName: newAdminName,
      }),
    });

    const data = (await response.json()) as {
      requestId?: string;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      setFeedback(data.error ?? "Unable to create admin.");
      setSubmittingAdminRequest(false);
      return;
    }

    setFeedback(data.message ?? `Admin request for ${newAdminId} submitted.`);
    setNewAdminId("");
    setNewAdminName("System Admin");
    setSubmittingAdminRequest(false);
    await loadAdminRequests();
  }

  async function reviewAdminRequest(requestId: string, decision: "approve" | "reject") {
    setReviewingRequestId(requestId);
    setFeedback(null);

    const response = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review-admin-request",
        requestId,
        decision,
      }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      admin?: { adminId: string; temporaryPassword: string };
      error?: string;
    };

    if (!response.ok) {
      setFeedback(data.error ?? "Unable to review admin request.");
      setReviewingRequestId(null);
      return;
    }

    if (decision === "approve" && data.admin) {
      setFeedback(
        `Request approved for ${data.admin.adminId}. Temporary password: ${data.admin.temporaryPassword}`
      );
      await loadUsers();
    } else {
      setFeedback("Admin request rejected.");
    }

    setReviewingRequestId(null);
    await loadAdminRequests();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h2 className="text-xl font-semibold">User Management</h2>
        <p className="mt-2 text-sm text-(--muted)">
          View all users, edit profile details, change role, or remove users.
        </p>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold">Request New Admin</h3>
        <p className="mt-1 text-sm text-(--muted)">
          Submit an admin access request. Another existing admin must approve it.
        </p>

        <form className="mt-4 grid gap-3" onSubmit={createAdminRequest}>
          <input
            type="text"
            value={newAdminName}
            onChange={(event) => setNewAdminName(event.target.value)}
            className="rounded-xl border border-(--card-border) bg-white px-3 py-2 text-sm"
            placeholder="Admin name"
            required
          />
          <input
            type="text"
            value={newAdminId}
            onChange={(event) => setNewAdminId(event.target.value.toLowerCase())}
            className="rounded-xl border border-(--card-border) bg-white px-3 py-2 text-sm"
            placeholder="admin-id"
            pattern="[a-z0-9._-]{3,32}"
            title="Use 3-32 lowercase letters, numbers, dot, underscore, or hyphen"
            required
          />
          <button
            type="submit"
            disabled={submittingAdminRequest}
            className="rounded-full bg-(--brand) px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-(--brand-strong) active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submittingAdminRequest ? "Submitting Request..." : "Submit Admin Request"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold">Pending Admin Requests ({requests.length})</h3>
        <p className="mt-1 text-sm text-(--muted)">
          A different admin must approve each request before access is created.
        </p>

        {loadingRequests ? (
          <p className="mt-3 text-sm text-(--muted)">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="mt-3 text-sm text-(--muted)">No pending admin requests.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {requests.map((request) => (
              <li key={request.id} className="rounded-xl border border-(--card-border) px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{request.fullName}</p>
                    <p className="text-sm text-(--muted)">Admin ID: {request.adminId}</p>
                    <p className="text-xs text-(--muted)">
                      Requested by {request.requestedBy.name} ({request.requestedBy.email}) on {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={reviewingRequestId === request.id}
                      onClick={() => void reviewAdminRequest(request.id, "approve")}
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {reviewingRequestId === request.id ? "Approving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingRequestId === request.id}
                      onClick={() => void reviewAdminRequest(request.id, "reject")}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {reviewingRequestId === request.id ? "Reviewing..." : "Reject"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {feedback ? (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          feedback.includes("successfully")
            ? "bg-green-50 text-green-900"
            : "bg-red-50 text-red-900"
        }`}>
          {feedback}
        </div>
      ) : null}

      {editingUserId ? (
        <div className="card p-6">
          <h3 className="text-lg font-semibold">Edit User</h3>
          <form className="mt-4 grid gap-3" onSubmit={saveUser}>
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="rounded-xl border border-(--card-border) bg-white px-3 py-2 text-sm"
              placeholder="Full name"
              required
            />
            <input
              type="email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
              className="rounded-xl border border-(--card-border) bg-white px-3 py-2 text-sm"
              placeholder="Email"
              required
            />
            <select
              value={editRole}
              onChange={(event) => setEditRole(event.target.value as UserRole)}
              className="rounded-xl border border-(--card-border) bg-white px-3 py-2 text-sm"
            >
              <option value="subscriber">Subscriber</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-full bg-(--brand) px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-(--brand-strong) active:translate-y-0 active:scale-[0.98]"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="flex-1 rounded-full border border-(--card-border) bg-white px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:bg-(--surface-hover) active:translate-y-0 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card p-6">
        <h3 className="text-lg font-semibold">All Users ({users.length})</h3>

        {loading ? (
          <p className="mt-3 text-sm text-(--muted)">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="mt-3 text-sm text-(--muted)">No users found.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {users.map((user) => (
              <li key={user.id} className="rounded-xl border border-(--card-border) px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-(--muted)">{user.email}</p>
                    <div className="mt-1 flex gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 font-semibold ${
                        user.role === "admin"
                          ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                          : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                      }`}>
                        {user.role}
                      </span>
                      <span className="text-(--muted)">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="rounded-full border border-(--card-border) bg-white px-3 py-1 text-xs font-semibold transition duration-200 hover:-translate-y-0.5 hover:bg-(--surface-hover) active:translate-y-0 active:scale-[0.98]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteUser(user.id)}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { adminEmailFromId, ADMIN_ID_PATTERN, createAdminAccount, normalizeAdminId } from "@/lib/admin-auth";
import { listSubscribers, updateLatestSubscriptionStatus, upsertSubscription } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Plan, SubscriptionStatus } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const allowedPlans: Plan[] = ["monthly", "yearly"];
const allowedStatuses: SubscriptionStatus[] = ["active", "inactive", "lapsed", "canceled"];
const allowedRoles = ["subscriber", "admin"] as const;

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "all") {
    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
      .from("users")
      .select("id, auth_user_id, full_name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const formatted = (users ?? []).map((entry) => ({
      id: entry.id,
      authUserId: entry.auth_user_id,
      name: entry.full_name,
      email: entry.email,
      role: entry.role,
      createdAt: entry.created_at,
    }));

    return NextResponse.json({ users: formatted });
  }

  if (scope === "admin-requests") {
    const supabase = getSupabaseAdmin();
    const { data: requests, error } = await supabase
      .from("notifications")
      .select("id, user_id, payload, delivery_status, created_at, users:user_id(full_name, email)")
      .eq("event_type", "admin_access_request")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const formatted = (requests ?? []).map((entry) => {
      const payload = (entry.payload as Record<string, unknown> | null) ?? {};
      const requestedBy = (entry.users as Record<string, unknown> | null) ?? null;

      return {
        id: entry.id,
        requestedByUserId: entry.user_id,
        adminId: String(payload.adminId ?? ""),
        fullName: String(payload.fullName ?? "System Admin"),
        status: String(entry.delivery_status ?? "pending"),
        createdAt: entry.created_at,
        requestedBy: {
          name: String(requestedBy?.full_name ?? "Unknown"),
          email: String(requestedBy?.email ?? ""),
        },
      };
    });

    return NextResponse.json({ requests: formatted });
  }

  const subscribers = await listSubscribers();
  return NextResponse.json({ users: subscribers });
}

export async function PATCH(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const userId = String(body.userId ?? "");
  const plan = String(body.plan ?? "") as Plan;
  const status = String(body.status ?? "") as SubscriptionStatus;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (plan && !allowedPlans.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan value." }, { status: 400 });
  }
  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid subscription status." }, { status: 400 });
  }
  if (role && !allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
  }

  const profileUpdates: Record<string, unknown> = {};
  if (name) profileUpdates.full_name = name;
  if (email) profileUpdates.email = email;
  if (role) profileUpdates.role = role;

  if (name) {
    const { data: sameNameUser } = await supabase
      .from("users")
      .select("id")
      .neq("id", userId)
      .ilike("full_name", name)
      .maybeSingle();
    if (sameNameUser) {
      return NextResponse.json({ error: "Another user already has this name." }, { status: 409 });
    }
  }

  if (email) {
    const { data: sameEmailUser } = await supabase
      .from("users")
      .select("id")
      .neq("id", userId)
      .eq("email", email)
      .maybeSingle();
    if (sameEmailUser) {
      return NextResponse.json({ error: "Another user already has this email." }, { status: 409 });
    }
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from("users")
      .update(profileUpdates)
      .eq("id", userId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
  }

  if (plan && status) {
    await upsertSubscription({
      userId,
      plan,
      status,
      amount: plan === "yearly" ? 290 : 29,
      renewalDate: new Date().toISOString(),
    });
  } else if (status) {
    await updateLatestSubscriptionStatus(userId, status);
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const body = await request.json();
  const action = String(body.action ?? "");

  if (action !== "create-admin-request") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const adminId = normalizeAdminId(body.adminId);
  const fullName = String(body.fullName ?? "").trim() || "System Admin";

  if (!adminId) {
    return NextResponse.json({ error: "Admin ID is required." }, { status: 400 });
  }

  if (!ADMIN_ID_PATTERN.test(adminId)) {
    return NextResponse.json(
      { error: "Admin ID must be 3-32 chars and use only lowercase letters, numbers, dot, underscore, or hyphen." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const adminEmail = adminEmailFromId(adminId);
  const { data: existingAdmin } = await supabase
    .from("users")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existingAdmin) {
    return NextResponse.json({ error: "Admin ID already exists." }, { status: 409 });
  }

  const { data: pendingRequest } = await supabase
    .from("notifications")
    .select("id")
    .eq("event_type", "admin_access_request")
    .eq("delivery_status", "pending")
    .contains("payload", { adminId })
    .maybeSingle();

  if (pendingRequest) {
    return NextResponse.json({ error: "An approval request for this admin ID is already pending." }, { status: 409 });
  }

  const { data: createdRequest, error: requestError } = await supabase
    .from("notifications")
    .insert({
      user_id: session.userId,
      event_type: "admin_access_request",
      payload: {
        adminId,
        fullName,
        requestedByUserId: session.userId,
      },
      delivery_status: "pending",
    })
    .select("id")
    .single();

  if (requestError || !createdRequest) {
    return NextResponse.json({ error: requestError?.message ?? "Unable to submit admin approval request." }, { status: 400 });
  }

  return NextResponse.json({ requestId: createdRequest.id, message: "Admin creation request submitted for approval." }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const action = String(body.action ?? "");
  const requestId = String(body.requestId ?? "");
  const decision = String(body.decision ?? "");

  if (action !== "review-admin-request") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (!requestId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json({ error: "requestId and a valid decision are required." }, { status: 400 });
  }

  const { data: requestRow, error: requestLookupError } = await supabase
    .from("notifications")
    .select("id, user_id, payload, delivery_status")
    .eq("id", requestId)
    .eq("event_type", "admin_access_request")
    .maybeSingle();

  if (requestLookupError || !requestRow) {
    return NextResponse.json({ error: "Admin approval request not found." }, { status: 404 });
  }

  if (String(requestRow.delivery_status) !== "pending") {
    return NextResponse.json({ error: "This request has already been reviewed." }, { status: 400 });
  }

  if (requestRow.user_id === session.userId) {
    return NextResponse.json({ error: "Another existing admin must approve this request." }, { status: 400 });
  }

  const payload = (requestRow.payload as Record<string, unknown> | null) ?? {};
  const adminId = normalizeAdminId(payload.adminId);
  const fullName = String(payload.fullName ?? "System Admin").trim() || "System Admin";

  if (!adminId || !ADMIN_ID_PATTERN.test(adminId)) {
    return NextResponse.json({ error: "Invalid admin ID in request payload." }, { status: 400 });
  }

  const nextPayload = {
    ...payload,
    reviewedByUserId: session.userId,
    reviewedAt: new Date().toISOString(),
    decision,
  };

  if (decision === "reject") {
    const { error: rejectError } = await supabase
      .from("notifications")
      .update({ delivery_status: "rejected", sent_at: new Date().toISOString(), payload: nextPayload })
      .eq("id", requestId);

    if (rejectError) {
      return NextResponse.json({ error: rejectError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  const adminEmail = adminEmailFromId(adminId);
  const { data: existingAdmin } = await supabase
    .from("users")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existingAdmin) {
    return NextResponse.json({ error: "Admin ID already exists." }, { status: 409 });
  }

  const temporaryPassword = randomBytes(9).toString("base64url");
  const createResult = await createAdminAccount(supabase, {
    adminId,
    fullName,
    password: temporaryPassword,
  });

  if (createResult.error || !createResult.authUserId) {
    return NextResponse.json({ error: createResult.error ?? "Unable to create admin credentials." }, { status: 400 });
  }

  const { error: approveError } = await supabase
    .from("notifications")
    .update({
      delivery_status: "approved",
      sent_at: new Date().toISOString(),
      payload: {
        ...nextPayload,
        approvedAdminUserId: createResult.authUserId,
      },
    })
    .eq("id", requestId);

  if (approveError) {
    return NextResponse.json({ error: approveError.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    admin: {
      adminId,
      email: createResult.email,
      fullName,
      temporaryPassword,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();
  const userId = String(body.userId ?? "");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  if (session.userId === userId) {
    return NextResponse.json({ error: "You cannot delete your own admin user." }, { status: 400 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: deleteProfileError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteProfileError) {
    return NextResponse.json({ error: deleteProfileError.message }, { status: 400 });
  }

  if (user.auth_user_id) {
    await supabase.auth.admin.deleteUser(user.auth_user_id);
  }

  return NextResponse.json({ success: true });
}

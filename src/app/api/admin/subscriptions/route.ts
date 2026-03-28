import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  const supabase = getSupabaseAdmin();
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("subscriptions")
    .select(
      `
      id,
      user_id,
      plan,
      status,
      renewal_date,
      amount,
      payment_customer_id,
      payment_subscription_id,
      created_at,
      updated_at,
      users:user_id(
        id,
        full_name,
        email,
        role
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: subscriptions, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const normalized = (subscriptions ?? []).map((entry) => {
    const rawUser = Array.isArray(entry.users) ? entry.users[0] : entry.users;
    return {
      id: entry.id,
      userId: entry.user_id,
      plan: entry.plan,
      status: entry.status,
      renewalDate: entry.renewal_date,
      amount: Number(entry.amount ?? 0),
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      user: {
        fullName: rawUser?.full_name ?? "Unknown User",
        email: rawUser?.email ?? "Unknown",
      },
    };
  });

  return NextResponse.json({ subscriptions: normalized, total: count ?? 0 });
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
  const subscriptionId = String(body.subscriptionId ?? "");
  const updates: Record<string, unknown> = {};

  if (body.status) updates.status = body.status;
  if (body.plan) updates.plan = body.plan;
  if (typeof body.renewalDate !== "undefined") updates.renewal_date = body.renewalDate;
  if (typeof body.amount !== "undefined") updates.amount = body.amount;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", subscriptionId)
    .select("id, user_id, plan, status, renewal_date, amount, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ subscription });
}

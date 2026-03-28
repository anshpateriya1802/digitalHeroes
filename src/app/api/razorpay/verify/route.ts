import crypto from "node:crypto";
import {
  createUnauthorizedResponse,
  getSessionFromRequest,
  getUserFromSessionDb,
  setSessionCookies,
} from "@/lib/auth";
import {
  getLatestCharityPreference,
  insertCharityContribution,
  upsertSubscription,
} from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

const PLAN_AMOUNTS = {
  monthly: 29,
  yearly: 290,
} as const;

function verifySignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is missing.");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return digest === signature;
}

function renewalDateForPlan(plan: "monthly" | "yearly") {
  const date = new Date();
  if (plan === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
}

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const user = await getUserFromSessionDb(session);
  if (!user) {
    return createUnauthorizedResponse();
  }

  const body = await request.json();
  const plan = String(body.plan ?? "") as "monthly" | "yearly";
  const orderId = String(body.razorpay_order_id ?? "");
  const paymentId = String(body.razorpay_payment_id ?? "");
  const signature = String(body.razorpay_signature ?? "");

  if (!orderId || !paymentId || !signature || (plan !== "monthly" && plan !== "yearly")) {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }

  if (!verifySignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  const amount = PLAN_AMOUNTS[plan];
  const renewalDate = renewalDateForPlan(plan);
  const inserted = await upsertSubscription({
    userId: user.id,
    plan,
    status: "active",
    amount,
    renewalDate,
    paymentCustomerId: paymentId,
    paymentSubscriptionId: orderId,
  });

  const pref = await getLatestCharityPreference(user.id);
  const contributionAmount = Number(((amount * pref.contributionPercent) / 100).toFixed(2));

  await insertCharityContribution({
    userId: user.id,
    subscriptionId: inserted.id,
    charityId: pref.charityId,
    contributionPercent: pref.contributionPercent,
    amount: contributionAmount,
    periodKey: periodKey(),
  });

  const response = NextResponse.json({ success: true });
  setSessionCookies(response, {
    ...user,
    subscription: {
      ...user.subscription,
      plan,
      status: "active",
      amount,
      renewalDate,
    },
  });
  return response;
}

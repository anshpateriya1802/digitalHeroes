import Razorpay from "razorpay";
import { createUnauthorizedResponse, getSessionFromRequest, getUserFromSessionDb } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const PLAN_AMOUNTS = {
  monthly: 29,
  yearly: 290,
} as const;

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured.");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
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

  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "Plan must be monthly or yearly." }, { status: 400 });
  }

  const razorpay = getRazorpay();
  const amountInPaise = PLAN_AMOUNTS[plan] * 100;
  // Generate receipt: max 40 chars. Use last 8 chars of UUID + Unix timestamp (seconds)
  // Example: "sub_9h0pyw0000_1711612345" ≈ 25 chars
  const userIdSuffix = user.id.slice(-8);
  const timestampSec = Math.floor(Date.now() / 1000);
  const receipt = `sub_${userIdSuffix}_${timestampSec}`;
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt,
    notes: {
      userId: user.id,
      plan,
    },
  });

  return NextResponse.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    order,
    plan,
    amount: PLAN_AMOUNTS[plan],
  });
}

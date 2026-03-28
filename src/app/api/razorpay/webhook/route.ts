import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getLatestCharityPreference,
  insertCharityContribution,
  updateLatestSubscriptionStatus,
  upsertSubscription,
} from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return false;
  }
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return digest === signature;
}

function planFromAmount(amount: number): "monthly" | "yearly" {
  return amount >= 290 ? "yearly" : "monthly";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as {
    event: string;
    payload?: Record<string, unknown>;
  };

  const entity = ((payload.payload?.payment as { entity?: Record<string, unknown> })?.entity ?? {}) as Record<string, unknown>;
  const notes = (entity.notes as Record<string, unknown> | undefined) ?? {};
  const userId = String(notes.userId ?? "");

  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  if (payload.event === "payment.captured" || payload.event === "subscription.charged") {
    const amount = Number(entity.amount ?? 0) / 100;
    const plan = planFromAmount(amount);
    const renewalDate = new Date(
      plan === "monthly"
        ? new Date().setMonth(new Date().getMonth() + 1)
        : new Date().setFullYear(new Date().getFullYear() + 1)
    ).toISOString();

    const inserted = await upsertSubscription({
      userId,
      plan,
      status: "active",
      amount,
      renewalDate,
      paymentCustomerId: String(entity.id ?? ""),
      paymentSubscriptionId: String(entity.order_id ?? ""),
    });

    const pref = await getLatestCharityPreference(userId);
    const contributionAmount = Number(((amount * pref.contributionPercent) / 100).toFixed(2));
    await insertCharityContribution({
      userId,
      subscriptionId: inserted.id,
      charityId: pref.charityId,
      contributionPercent: pref.contributionPercent,
      amount: contributionAmount,
      periodKey: periodKey(),
    });
  }

  if (payload.event === "payment.failed") {
    await updateLatestSubscriptionStatus(userId, "lapsed");
  }

  if (payload.event === "subscription.cancelled") {
    await updateLatestSubscriptionStatus(userId, "canceled");
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("notifications").insert({
    user_id: userId,
    event_type: payload.event,
    payload,
    delivery_status: "logged",
  });

  return NextResponse.json({ ok: true });
}

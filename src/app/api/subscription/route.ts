import {
  createUnauthorizedResponse,
  getSessionFromRequest,
  getUserFromSessionDb,
  setSessionCookies,
} from "@/lib/auth";
import { upsertSubscription, updateLatestSubscriptionStatus } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

const PLAN_PRICES = {
  monthly: 29,
  yearly: 290,
} as const;

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
  const action = String(body.action ?? "subscribe");

  if (action === "subscribe") {
    const plan = String(body.plan ?? "") as "monthly" | "yearly";
    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json({ error: "Plan must be monthly or yearly." }, { status: 400 });
    }

    const renewalDate =
      plan === "monthly"
        ? new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
        : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

    await upsertSubscription({
      userId: user.id,
      plan,
      status: "active",
      amount: PLAN_PRICES[plan],
      renewalDate,
    });

    const response = NextResponse.json({
      subscription: {
        ...user.subscription,
        plan,
        status: "active",
        amount: PLAN_PRICES[plan],
        renewalDate,
      },
    });
    setSessionCookies(response, {
      ...user,
      subscription: {
        ...user.subscription,
        plan,
        status: "active",
        amount: PLAN_PRICES[plan],
        renewalDate,
      },
    });
    return response;
  }

  if (action === "cancel") {
    await updateLatestSubscriptionStatus(user.id, "canceled");
    const response = NextResponse.json({ subscription: { ...user.subscription, status: "canceled" } });
    setSessionCookies(response, {
      ...user,
      subscription: {
        ...user.subscription,
        status: "canceled",
      },
    });
    return response;
  }

  return NextResponse.json({ error: "Unsupported subscription action." }, { status: 400 });
}

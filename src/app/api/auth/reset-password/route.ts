import { adminEmailFromId, ADMIN_ID_PATTERN, normalizeAdminId } from "@/lib/admin-auth";
import { setSessionCookies } from "@/lib/auth";
import { getUserWithSubscriptionByAuthUserId, getUserWithSubscriptionByEmailAndRole } from "@/lib/data";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

type Context = "subscriber" | "admin";

export async function POST(request: NextRequest) {
  let body: { email?: string; adminId?: string; token?: string; password?: string; context?: Context };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  const context: Context = body.context === "admin" ? "admin" : "subscriber";

  if (!token || token.length < 6) {
    return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let email: string;

  if (context === "admin") {
    const adminId = normalizeAdminId(body.adminId);
    if (!adminId || !ADMIN_ID_PATTERN.test(adminId)) {
      return NextResponse.json({ error: "Enter a valid admin ID." }, { status: 400 });
    }
    email = adminEmailFromId(adminId);
  } else {
    email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
  }

  const expected = await getUserWithSubscriptionByEmailAndRole(email, context === "admin" ? "admin" : "subscriber");
  if (!expected?.authUserId) {
    return NextResponse.json({ error: "Invalid code or account." }, { status: 400 });
  }

  const supabase = getSupabasePublic();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (verifyError || !verifyData.user) {
    return NextResponse.json({ error: verifyError?.message ?? "Invalid or expired code." }, { status: 400 });
  }

  if (verifyData.user.id !== expected.authUserId) {
    return NextResponse.json({ error: "Could not verify account." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error: updateError } = await admin.auth.admin.updateUserById(verifyData.user.id, {
    password,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message ?? "Unable to update password." }, { status: 400 });
  }

  const user = await getUserWithSubscriptionByAuthUserId(verifyData.user.id);
  if (!user || user.role !== expected.role) {
    return NextResponse.json({ error: "Account could not be loaded after reset." }, { status: 500 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
    },
  });

  setSessionCookies(response, user);
  return response;
}

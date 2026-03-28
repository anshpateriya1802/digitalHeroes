import { adminEmailFromId, ADMIN_ID_PATTERN, normalizeAdminId } from "@/lib/admin-auth";
import { getUserWithSubscriptionByEmailAndRole } from "@/lib/data";
import { getSupabasePublic } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const GENERIC_OK =
  "If an account matches those details, we sent a sign-in code to the email on file. Check your inbox and spam folder.";

type Context = "subscriber" | "admin";

export async function POST(request: NextRequest) {
  let body: { email?: string; adminId?: string; context?: Context };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const context: Context = body.context === "admin" ? "admin" : "subscriber";

  let email: string;

  if (context === "admin") {
    const adminId = normalizeAdminId(body.adminId);
    if (!adminId || !ADMIN_ID_PATTERN.test(adminId)) {
      return NextResponse.json({ error: "Enter a valid admin ID (3–32 lowercase letters, numbers, dot, underscore, or hyphen)." }, { status: 400 });
    }
    email = adminEmailFromId(adminId);
    const user = await getUserWithSubscriptionByEmailAndRole(email, "admin");
    if (!user) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }
  } else {
    email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const user = await getUserWithSubscriptionByEmailAndRole(email, "subscriber");
    if (!user) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }
  }

  const supabase = getSupabasePublic();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Unable to send sign-in code. Check Supabase Auth email settings." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_OK });
}

import { setSessionCookies } from "@/lib/auth";
import { ADMIN_ID_PATTERN, adminEmailFromId, createAdminAccount, normalizeAdminId } from "@/lib/admin-auth";
import { getUserWithSubscriptionByAuthUserId } from "@/lib/data";
import { getSupabaseAdmin, getSupabasePublic } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

async function hasAnyAdmin() {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  return (count ?? 0) > 0;
}

export async function GET() {
  const hasAdmin = await hasAnyAdmin();
  return NextResponse.json({ hasAdmin });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = String(body.action ?? "login");

  const adminId = normalizeAdminId(body.adminId);
  const password = String(body.password ?? "");

  if (!adminId || !password) {
    return NextResponse.json({ error: "Admin ID and password are required." }, { status: 400 });
  }

  if (!ADMIN_ID_PATTERN.test(adminId)) {
    return NextResponse.json(
      { error: "Admin ID must be 3-32 chars and use only lowercase letters, numbers, dot, underscore, or hyphen." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  if (action === "bootstrap") {
    const adminExists = await hasAnyAdmin();
    if (adminExists) {
      return NextResponse.json(
        { error: "Admin credentials already exist. Use login mode." },
        { status: 409 }
      );
    }

    const fullName = String(body.fullName ?? "System Admin").trim() || "System Admin";
    const supabaseAdmin = getSupabaseAdmin();

    const createResult = await createAdminAccount(supabaseAdmin, {
      adminId,
      password,
      fullName,
    });

    if (createResult.error || !createResult.authUserId) {
      return NextResponse.json({ error: createResult.error ?? "Unable to create admin credentials." }, { status: 400 });
    }

    const user = await getUserWithSubscriptionByAuthUserId(createResult.authUserId);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Admin profile creation failed." }, { status: 500 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    setSessionCookies(response, user);
    return response;
  }

  if (action === "login") {
    const email = adminEmailFromId(adminId);
    const supabasePublic = getSupabasePublic();
    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const user = await getUserWithSubscriptionByAuthUserId(authData.user.id);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "This account does not have admin access." }, { status: 403 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    setSessionCookies(response, user);
    return response;
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

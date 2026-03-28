import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
  return to;
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/auth/sign-in", request.url);
  signInUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

function redirectToAdminControlRoom(request: NextRequest) {
  const adminUrl = new URL("/control-room", request.url);
  return NextResponse.redirect(adminUrl);
}

export async function proxy(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const userId = request.cookies.get("dh_user_id")?.value;
  const role = request.cookies.get("dh_role")?.value;
  const subscriptionActive = request.cookies.get("dh_sub_active")?.value === "true";
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/dashboard")) {
    if (!userId || (role !== "subscriber" && role !== "admin")) {
      return copyCookies(supabaseResponse, redirectToSignIn(request));
    }
  }

  if (pathname.startsWith("/api/scores") || pathname.startsWith("/api/draws/practice")) {
    if (!userId || (role !== "subscriber" && role !== "admin")) {
      return copyCookies(
        supabaseResponse,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    if (role === "subscriber" && !subscriptionActive) {
      return copyCookies(
        supabaseResponse,
        NextResponse.json(
          { error: "Active subscription required for this feature." },
          { status: 403 }
        )
      );
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!userId || role !== "admin") {
      return copyCookies(supabaseResponse, redirectToAdminControlRoom(request));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/scores/:path*", "/api/draws/practice"],
};

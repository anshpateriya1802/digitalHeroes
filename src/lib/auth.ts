import { Role, User } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { getUserWithSubscriptionById } from "@/lib/data";

export const SESSION_USER_COOKIE = "dh_user_id";
export const SESSION_ROLE_COOKIE = "dh_role";
export const SESSION_SUB_ACTIVE_COOKIE = "dh_sub_active";

export interface Session {
  userId: string;
  role: Role;
}

export function getSessionFromRequest(request: NextRequest): Session | null {
  const userId = request.cookies.get(SESSION_USER_COOKIE)?.value;
  const role = request.cookies.get(SESSION_ROLE_COOKIE)?.value;

  if (!userId || (role !== "subscriber" && role !== "admin")) {
    return null;
  }

  return {
    userId,
    role,
  };
}

export function getUserFromSession(): User | null {
  throw new Error("getUserFromSession is deprecated. Use getUserFromSessionDb.");
}

export async function getUserFromSessionDb(session: Session | null) {
  if (!session) {
    return null;
  }
  const user = await getUserWithSubscriptionById(session.userId);
  if (!user || user.role !== session.role) {
    return null;
  }
  return user;
}

export function createUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function createForbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function setSessionCookies(response: NextResponse, user: User) {
  const isActive = user.subscription.status === "active";
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  response.cookies.set(SESSION_USER_COOKIE, user.id, cookieOptions);
  response.cookies.set(SESSION_ROLE_COOKIE, user.role, cookieOptions);
  response.cookies.set(SESSION_SUB_ACTIVE_COOKIE, String(isActive), cookieOptions);
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_USER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(SESSION_ROLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(SESSION_SUB_ACTIVE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

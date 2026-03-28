import { runDbDraw } from "@/lib/draw-service";
import { DrawMode } from "@/lib/types";
import {
  createForbiddenResponse,
  createUnauthorizedResponse,
  getSessionFromRequest,
} from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }
  if (session.role !== "admin") {
    return createForbiddenResponse();
  }

  try {
    const body = await request.json();
    const mode = (body.mode as DrawMode) ?? "random";
    const summary = await runDbDraw(mode, true);
    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish draw.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
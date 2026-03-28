import { createUnauthorizedResponse, getSessionFromRequest } from "@/lib/auth";
import { runPracticeDrawForUserDb } from "@/lib/draw-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return createUnauthorizedResponse();
  }

  const result = await runPracticeDrawForUserDb(session.userId);
  return NextResponse.json({
    result: {
      ...result,
      referenceId: crypto.randomUUID(),
    },
  });
}

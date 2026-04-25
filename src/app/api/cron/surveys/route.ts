import { NextResponse } from "next/server";
import { dispatchPostVisitSurveys } from "@/server/surveys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await dispatchPostVisitSurveys();
  return NextResponse.json(result);
}

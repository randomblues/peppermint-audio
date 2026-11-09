import { GET as calendarResponse } from "../route";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string; kind: string }> }) {
  return calendarResponse(request, context);
}

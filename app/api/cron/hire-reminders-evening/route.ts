import { runHireRemindersCron } from "@/lib/booking-sms-cron";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return runHireRemindersCron(request);
}

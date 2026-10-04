import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { sendBookingConfirmationEmail } from "@/lib/send-booking-confirmation";
import { recordCustomerEmail } from "@/lib/email-log";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { bookingId?: string };
  try {
    body = await request.json() as { bookingId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.bookingId) return NextResponse.json({ error: "A booking ID is required." }, { status: 400 });

  const result = await session.admin.from("bookings")
    .select("id,email,first_name,event_type,pickup_date,dropoff_date,pickup_time,dropoff_time,created_at,hire_line_items,additional_details,status")
    .eq("id", body.bookingId)
    .single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Booking could not be found." }, { status: 404 });
  if (result.data.status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed bookings can receive a confirmation email." }, { status: 400 });
  }

  try {
    const id = await sendBookingConfirmationEmail(result.data);
    try {
      await recordCustomerEmail(session.admin, {
        bookingId: body.bookingId,
        recipientEmail: result.data.email,
        emailType: "confirmation",
        providerMessageId: id,
      });
    } catch (error) {
      console.error("Confirmation email log failed:", error);
    }
    const update = await session.admin.from("bookings")
      .update({ confirmation_email_sent: true, updated_at: new Date().toISOString() })
      .eq("id", body.bookingId);
    if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Booking confirmation email failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Booking confirmation email could not be sent.",
    }, { status: 502 });
  }
}

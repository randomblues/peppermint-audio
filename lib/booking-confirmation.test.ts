import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendBookingConfirmationEmail: vi.fn(),
  recordCustomerEmail: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/send-booking-confirmation", () => ({ sendBookingConfirmationEmail: mocks.sendBookingConfirmationEmail }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: mocks.recordCustomerEmail }));

import { createAdminClient } from "@/lib/supabase";
import { confirmPaidStripeBooking } from "./booking-confirmation";

const booking = {
  id: "booking-1", status: "submitted", hire_payment_status: "paid",
  email: "customer@example.com", first_name: "Alex", confirmation_email_sent: false, hire_line_items: [],
};

function client(overrides = {}, error: { message: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ...booking, ...overrides }, error }),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn<() => Promise<{ data: { id: string } | null; error: { message: string } | null }>>().mockResolvedValue({ data: { id: booking.id }, error: null }),
    then(resolve: (value: { error: null }) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
  };
  const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
  mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query), rpc });
  return Object.assign(query, { rpc });
}

describe("paid Stripe booking confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendBookingConfirmationEmail.mockResolvedValue("email-1");
    mocks.recordCustomerEmail.mockResolvedValue(undefined);
  });

  it("persists confirmation before emailing and tracks delivery", async () => {
    const query = client();
    await confirmPaidStripeBooking(createAdminClient(), booking.id);
    expect(query.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "confirmed" }));
    expect(query.eq).toHaveBeenCalledWith("status", "submitted");
    expect(query.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendBookingConfirmationEmail.mock.invocationCallOrder[0]);
    expect(query.update).toHaveBeenLastCalledWith(expect.objectContaining({ confirmation_email_sent: true }));
    expect(mocks.recordCustomerEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ bookingId: booking.id, emailType: "confirmation" }));
  });

  it.each([
    { status: "cancelled" }, { status: "completed" }, { hire_payment_status: "processing" },
    { hire_payment_status: "failed" }, { status: "confirmed", confirmation_email_sent: true },
  ])("does not confirm or email an ineligible/already-delivered booking: %j", async (overrides) => {
    const query = client(overrides);
    await confirmPaidStripeBooking(createAdminClient(), booking.id);
    expect(query.update).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not email when a concurrent status change prevents confirmation", async () => {
    const query = client();
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await confirmPaidStripeBooking(createAdminClient(), booking.id);
    expect(mocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not confirm or email a paid Stripe booking when stock cannot be reserved", async () => {
    const query = client();
    query.rpc.mockResolvedValueOnce({
      data: { ok: false, error: "Insufficient inventory for the selected dates." },
      error: null,
    });

    await expect(confirmPaidStripeBooking(createAdminClient(), booking.id)).rejects.toThrow("Insufficient inventory for the selected dates.");
    expect(query.update).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("retries an undelivered confirmation on a duplicate paid webhook", async () => {
    const query = client({ status: "confirmed" });
    await confirmPaidStripeBooking(createAdminClient(), booking.id);
    expect(mocks.sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(query.update).toHaveBeenCalledTimes(1);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ confirmation_email_sent: true }));
  });

  it("surfaces read, write and delivery failures", async () => {
    client({}, { message: "database down" });
    await expect(confirmPaidStripeBooking(createAdminClient(), booking.id)).rejects.toThrow("database down");
    const query = client();
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "write failed" } });
    await expect(confirmPaidStripeBooking(createAdminClient(), booking.id)).rejects.toThrow("write failed");
    client();
    mocks.sendBookingConfirmationEmail.mockRejectedValueOnce(new Error("provider down"));
    await expect(confirmPaidStripeBooking(createAdminClient(), booking.id)).rejects.toThrow("Booking confirmed, but the confirmation email failed");
  });
});

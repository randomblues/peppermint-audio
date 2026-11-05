import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminJson: vi.fn(),
  sendTrackedBookingConfirmation: vi.fn(),
  markInvoiceStatus: vi.fn(),
  sendBillingDocument: vi.fn(),
  releaseCancelledDeferredDeposit: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/admin-request", () => ({ requireAdminJson: mocks.requireAdminJson }));
vi.mock("@/lib/booking-confirmation", () => ({
  ConfirmationError: class ConfirmationError extends Error {
    status = 502;
  },
  sendTrackedBookingConfirmation: mocks.sendTrackedBookingConfirmation,
}));
vi.mock("@/lib/invoice-service", () => ({
  markInvoiceStatus: mocks.markInvoiceStatus,
  sendBillingDocument: mocks.sendBillingDocument,
}));
vi.mock("@/lib/deferred-deposits", () => ({ releaseCancelledDeferredDeposit: mocks.releaseCancelledDeferredDeposit }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));

import { PATCH } from "./route";

const booking = {
  id: "booking-1",
  email: "alex@example.com",
  first_name: "Alex",
  event_type: "Party",
  pickup_date: "2099-10-01",
  dropoff_date: "2099-10-02",
  pickup_time: null,
  dropoff_time: null,
  created_at: "2099-09-01T00:00:00.000Z",
  hire_line_items: [{
    id: "equipment:bose-s1-pro:Single speaker",
    kind: "equipment",
    catalogKey: "equipment:bose-s1-pro:Single speaker",
    name: "Bose S1 Pro PA Speaker",
    quantity: 1,
    unitPriceCents: 5500,
  }],
  additional_details: "",
  confirmation_email_sent: false,
  hire_payment_status: "paid",
  payment_method: "stripe_card_hold",
  security_deposit_cents: 0,
};

function session(reservation: unknown = { data: { ok: true }, error: null }, bookingLookup = true, bookingData = booking) {
  const lookup = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: bookingData, error: null }),
  };
  const update = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    admin: {
      from: bookingLookup ? vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update) : vi.fn().mockReturnValue(update),
      rpc: vi.fn()
        .mockResolvedValueOnce(reservation)
        .mockResolvedValue({ data: null, error: null }),
    },
    update,
  };
}

describe("admin booking inventory guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendTrackedBookingConfirmation.mockResolvedValue({ sent: true });
    mocks.markInvoiceStatus.mockResolvedValue(undefined);
    mocks.sendBillingDocument.mockResolvedValue(undefined);
    mocks.releaseCancelledDeferredDeposit.mockResolvedValue(undefined);
    mocks.getStripe.mockReturnValue({
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({ status: "requires_payment_method" }),
        cancel: vi.fn().mockResolvedValue({ status: "canceled" }),
      },
    });
  });

  it("blocks confirmation and customer confirmation email when inventory is short", async () => {
    const inventoryError = "Insufficient inventory. Bose speaker: this booking needs 1 unit, but only 0 are available.";
    const admin = session({ data: { ok: false, error: inventoryError }, error: null });
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "confirmed" } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: inventoryError });
    expect(admin.update.update).not.toHaveBeenCalled();
    expect(mocks.sendTrackedBookingConfirmation).not.toHaveBeenCalled();
  });

  it("checks inventory before confirming and sending the customer email", async () => {
    const admin = session();
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "confirmed" } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(200);
    expect(admin.admin.rpc).toHaveBeenCalledWith("reserve_booking_inventory", {
      p_booking_id: booking.id,
      p_hire_line_items: booking.hire_line_items,
    });
    expect(admin.update.update).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }));
    expect(mocks.sendTrackedBookingConfirmation).toHaveBeenCalled();
  });

  it("switches an unpaid Standard request to bank transfer when recording receipt", async () => {
    const stripe = {
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValue({ status: "requires_payment_method" }),
        cancel: vi.fn().mockResolvedValue({ status: "canceled" }),
      },
    };
    mocks.getStripe.mockReturnValue(stripe);
    const standardBooking = {
      ...booking,
      payment_method: "stripe_card_hold",
      bank_transfer_option: "both",
      hire_payment_status: "pending",
      deposit_payment_status: "scheduled",
      security_deposit_cents: 10000,
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: "pi_deposit",
    };
    const admin = session(undefined, true, standardBooking);
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "confirmed", payment_received: true } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(200);
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledTimes(2);
    expect(admin.update.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "confirmed",
      payment_method: "bank_transfer",
      payment_token: null,
      stripe_hire_payment_intent_id: null,
      stripe_deposit_payment_intent_id: null,
      hire_payment_status: "bank_transfer_received",
      deposit_payment_status: "bank_transfer_received",
    }));
    expect(mocks.sendBillingDocument).toHaveBeenCalledWith(
      admin.admin,
      booking.id,
      "payment_receipt",
      undefined,
      false,
      "both",
      undefined,
      true,
    );
  });

  it("does not record a Standard bank transfer while a Stripe payment is processing", async () => {
    const stripe = {
      paymentIntents: {
        retrieve: vi.fn().mockResolvedValueOnce({ status: "processing" }).mockResolvedValueOnce({ status: "requires_capture" }),
        cancel: vi.fn().mockResolvedValue({ status: "canceled" }),
      },
    };
    mocks.getStripe.mockReturnValue(stripe);
    const standardBooking = {
      ...booking,
      payment_method: "stripe_card_hold",
      bank_transfer_option: "both",
      hire_payment_status: "pending",
      deposit_payment_status: "scheduled",
      stripe_hire_payment_intent_id: "pi_hire",
      stripe_deposit_payment_intent_id: "pi_deposit",
    };
    const admin = session(undefined, true, standardBooking);
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "confirmed", payment_received: true } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("could not be closed safely") });
    expect(admin.update.update).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("releases the inventory reservation when a booking is cancelled", async () => {
    const admin = session(undefined, false);
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "cancelled" } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(200);
    expect(admin.admin.rpc).toHaveBeenCalledWith("release_booking_inventory", { p_booking_id: booking.id });
  });
});

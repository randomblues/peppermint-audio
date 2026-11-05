import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminJson: vi.fn(),
  sendTrackedBookingConfirmation: vi.fn(),
  markInvoiceStatus: vi.fn(),
  sendBillingDocument: vi.fn(),
  releaseCancelledDeferredDeposit: vi.fn(),
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

function session(reservation: unknown = { data: { ok: true }, error: null }, bookingLookup = true) {
  const lookup = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: booking, error: null }),
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

  it("releases the inventory reservation when a booking is cancelled", async () => {
    const admin = session(undefined, false);
    mocks.requireAdminJson.mockResolvedValue({ session: admin, body: { id: booking.id, status: "cancelled" } });

    const response = await PATCH(new Request("http://localhost/api/admin/bookings", { method: "PATCH" }));

    expect(response.status).toBe(200);
    expect(admin.admin.rpc).toHaveBeenCalledWith("release_booking_inventory", { p_booking_id: booking.id });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));

import { GET } from "./route";

const invoices = [
  {
    booking_id: "booking-1",
    invoice_number: "PA-ONE",
    issued_at: "2026-07-02T01:00:00.000Z",
    paid_at: "2026-07-03T01:00:00.000Z",
    status: "paid",
    payment_method: "bank_transfer",
    hire_amount_cents: 10000,
    security_deposit_cents: 10000,
    total_amount_cents: 20000,
  },
  {
    booking_id: "booking-2",
    invoice_number: "PA-TWO",
    issued_at: "2026-07-04T01:00:00.000Z",
    paid_at: null,
    status: "issued",
    payment_method: "bank_transfer",
    hire_amount_cents: 5500,
    security_deposit_cents: 0,
    total_amount_cents: 5500,
  },
];
const purchases = [{
  id: "purchase-1",
  product_name: "Bose S1 Pro PA Speaker",
  purchase_date: "2026-07-05",
  quantity: 2,
  total_cost_cents: 110000,
  gst_paid_cents: 10000,
  supplier: "Audio shop",
  reference: "INV-100",
}];

function session() {
  const query = (data: unknown[]) => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error: null }),
  });
  return { admin: { from: vi.fn((table: string) => query(table === "invoices" ? invoices : purchases)) } };
}

describe("admin GST report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(session());
  });

  it("summarises paid GST-inclusive hire charges and excludes deposits", async () => {
    const response = await GET(new Request("http://localhost/api/admin/tax-report?from=2026-07-01&to=2026-07-31&basis=paid"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      basis: "paid",
      summary: {
        invoiceCount: 1,
        taxableSalesCents: 10000,
        gstIncludedCents: 909,
        securityDepositCents: 10000,
        totalAmountCents: 20000,
      },
      purchaseSummary: { purchaseCount: 1, totalCostCents: 110000, gstPaidCents: 10000 },
      purchases: [{ productName: "Bose S1 Pro PA Speaker", gstPaidCents: 10000 }],
    });
  });

  it("downloads an issued-basis CSV", async () => {
    const response = await GET(new Request("http://localhost/api/admin/tax-report?from=2026-07-01&to=2026-07-31&basis=issued&format=csv"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("invoice_number,date,paid_at");
    expect(body).toContain('"PA-TWO"');
    expect(body).toContain('"55.00"');
    expect(body).toContain("EQUIPMENT_PURCHASES");
    expect(body).toContain('"Audio shop"');
    expect(body).toContain('"100.00"');
  });

  it("rejects unauthorised access and invalid ranges", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/admin/tax-report?from=2026-07-01&to=2026-07-31&basis=paid"))).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/admin/tax-report?from=2026-08-01&to=2026-07-31&basis=paid"))).status).toBe(400);
  });
});

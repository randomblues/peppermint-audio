import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireAdminJson: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin-request", () => ({ requireAdminJson: mocks.requireAdminJson }));

import { GET, POST } from "./route";

describe("admin inventory route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only returns inventory records to an authenticated admin", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);

    const products = { data: [{ id: "p1", name: "Speaker", category: "Speakers", quantity_on_hand: 4 }], error: null };
    const mappings = { data: [], error: null };
    const purchases = { data: [], error: null };
    const movements = { data: [], error: null };
    const query = (response: unknown) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
    });
    const from = vi.fn()
      .mockReturnValueOnce(query(products))
      .mockReturnValueOnce(query(mappings))
      .mockReturnValueOnce(query(purchases))
      .mockReturnValueOnce(query(movements));
    mocks.requireAdmin.mockResolvedValueOnce({ admin: { from } });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      products: products.data,
      mappings: mappings.data,
      purchases: purchases.data,
      movements: movements.data,
    });
  });

  it("does not accept requests to toggle automatic stock checks", async () => {
    const rpc = vi.fn();
    mocks.requireAdminJson.mockResolvedValue({
      session: { admin: { rpc } },
      body: {
        action: "set_listing_tracked",
        catalogKey: "equipment:bose-s1-pro:Single speaker",
        tracked: false,
      },
    });

    const response = await POST(new Request("http://localhost/api/admin/inventory", { method: "POST" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "A valid inventory action is required." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates products through the service-side database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "product-id", error: null });
    mocks.requireAdminJson.mockResolvedValue({
      session: { admin: { rpc } },
      body: {
        action: "create_product",
        name: "Smoke machine",
        category: "Effects",
        openingQuantity: 1,
        mappings: [{ catalogKey: "package:standard-party-events", unitsPerLineItem: 1 }],
      },
    });
    const response = await POST(new Request("http://localhost/api/admin/inventory", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_inventory_product", expect.objectContaining({
      p_name: "Smoke machine",
      p_category: "Effects",
      p_opening_quantity: 1,
    }));
  });

  it("rejects unlisted catalog keys and GST greater than purchase cost", async () => {
    mocks.requireAdminJson
      .mockResolvedValueOnce({
        session: { admin: { rpc: vi.fn() } },
        body: { action: "create_product", name: "Speaker", category: "Speakers", openingQuantity: 1, mappings: [{ catalogKey: "unknown", unitsPerLineItem: 1 }] },
      })
      .mockResolvedValueOnce({
        session: { admin: { rpc: vi.fn() } },
        body: {
          action: "record_purchase",
          productId: "7b6e5e2e-6bc7-4c7f-a5e0-34d065f80f84",
          purchaseDate: "2026-11-05",
          quantity: 1,
          totalCostCents: 5000,
          gstPaidCents: 5001,
        },
      });

    expect((await POST(new Request("http://localhost/api/admin/inventory", { method: "POST" }))).status).toBe(400);
    expect((await POST(new Request("http://localhost/api/admin/inventory", { method: "POST" }))).status).toBe(400);
  });
});

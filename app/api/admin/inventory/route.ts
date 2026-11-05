import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { requireAdminJson } from "@/lib/admin-request";
import {
  inventoryAdjustmentSchema,
  inventoryCatalogKeySchema,
  inventoryMappingsSchema,
  inventoryProductSchema,
  inventoryPurchaseSchema,
} from "@/lib/inventory";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, mappings, trackedListings, purchases, movements] = await Promise.all([
    session.admin.from("inventory_products").select("id,name,category,quantity_on_hand,created_at,updated_at").order("category").order("name"),
    session.admin.from("inventory_product_mappings").select("product_id,catalog_key,units_per_line_item").order("catalog_key"),
    session.admin.from("inventory_tracked_listings").select("catalog_key").order("catalog_key"),
    session.admin.from("inventory_purchases")
      .select("id,product_id,product_name,purchase_date,quantity,total_cost_cents,gst_paid_cents,supplier,reference,created_at")
      .order("purchase_date", { ascending: false }),
    session.admin.from("inventory_stock_movements")
      .select("id,product_id,movement_type,quantity_change,reason,created_at")
      .order("created_at", { ascending: false }),
  ]);
  const error = products.error ?? mappings.error ?? trackedListings.error ?? purchases.error ?? movements.error;
  if (error) return NextResponse.json({ error: `Inventory could not be loaded: ${error.message}` }, { status: 500 });

  return NextResponse.json({
    products: products.data ?? [],
    mappings: mappings.data ?? [],
    trackedListings: (trackedListings.data ?? []).map((listing) => listing.catalog_key),
    purchases: purchases.data ?? [],
    movements: movements.data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminJson<Record<string, unknown>>(request);
  if ("response" in auth) return auth.response;
  const { session, body } = auth;

  if (body.action === "create_product") {
    const parsed = inventoryProductSchema.safeParse({
      name: body.name,
      category: body.category,
      openingQuantity: body.openingQuantity,
      mappings: body.mappings,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Product details are invalid." }, { status: 400 });
    const { data, error } = await session.admin.rpc("create_inventory_product", {
      p_name: parsed.data.name,
      p_category: parsed.data.category,
      p_opening_quantity: parsed.data.openingQuantity,
      p_mappings: parsed.data.mappings,
    });
    if (error) return NextResponse.json({ error: `Inventory product could not be created: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, productId: data });
  }

  if (body.action === "replace_mappings") {
    const productId = typeof body.productId === "string" ? body.productId : "";
    const parsed = inventoryMappingsSchema.safeParse(body.mappings);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId) || !parsed.success) {
      return NextResponse.json({ error: parsed.success ? "Inventory product ID is invalid." : parsed.error.issues[0]?.message ?? "Product mappings are invalid." }, { status: 400 });
    }
    const { error } = await session.admin.rpc("replace_inventory_product_mappings", {
      p_product_id: productId,
      p_mappings: parsed.data,
    });
    if (error) return NextResponse.json({ error: `Product mappings could not be saved: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_listing_tracked") {
    const parsed = inventoryCatalogKeySchema.safeParse(body.catalogKey);
    if (!parsed.success || typeof body.tracked !== "boolean") {
      return NextResponse.json({ error: parsed.success ? "Listing tracking must be true or false." : parsed.error.issues[0]?.message ?? "Catalog listing is invalid." }, { status: 400 });
    }
    const { error } = await session.admin.rpc("set_inventory_listing_tracked", {
      p_catalog_key: parsed.data,
      p_tracked: body.tracked,
    });
    if (error) return NextResponse.json({ error: `Listing coverage could not be saved: ${error.message}` }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "record_purchase") {
    const parsed = inventoryPurchaseSchema.safeParse({
      productId: body.productId,
      purchaseDate: body.purchaseDate,
      quantity: body.quantity,
      totalCostCents: body.totalCostCents,
      gstPaidCents: body.gstPaidCents,
      supplier: body.supplier,
      reference: body.reference,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Purchase details are invalid." }, { status: 400 });
    const { error } = await session.admin.rpc("record_inventory_purchase", {
      p_product_id: parsed.data.productId,
      p_purchase_date: parsed.data.purchaseDate,
      p_quantity: parsed.data.quantity,
      p_total_cost_cents: parsed.data.totalCostCents,
      p_gst_paid_cents: parsed.data.gstPaidCents,
      p_supplier: parsed.data.supplier,
      p_reference: parsed.data.reference,
    });
    if (error) return NextResponse.json({ error: `Purchase could not be recorded: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "adjust_stock") {
    const parsed = inventoryAdjustmentSchema.safeParse({
      productId: body.productId,
      quantityChange: body.quantityChange,
      reason: body.reason,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Stock adjustment is invalid." }, { status: 400 });
    const { data, error } = await session.admin.rpc("adjust_inventory_stock", {
      p_product_id: parsed.data.productId,
      p_quantity_change: parsed.data.quantityChange,
      p_reason: parsed.data.reason,
    });
    if (error) return NextResponse.json({ error: `Stock could not be adjusted: ${error.message}` }, { status: 409 });
    return NextResponse.json({ ok: true, quantityOnHand: data });
  }

  return NextResponse.json({ error: "A valid inventory action is required." }, { status: 400 });
}

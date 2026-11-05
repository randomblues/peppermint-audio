import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase", "001_booking_management.sql"), "utf8");
const reservationFunction = migration.match(
  /create or replace function public\.reserve_booking_inventory\([\s\S]*?\n\$\$;/i,
)?.[0] ?? "";

describe("inventory reservation migration", () => {
  it("checks every mapped listing without a per-listing tracking flag", () => {
    expect(reservationFunction).not.toBe("");
    expect(reservationFunction).toMatch(
      /if v_catalog_key is null or not exists \([\s\S]*?from public\.inventory_product_mappings mapping[\s\S]*?where mapping\.catalog_key = v_catalog_key/,
    );
    expect(reservationFunction).not.toContain("inventory_tracked_listings");
    expect(migration).toContain("drop function if exists public.set_inventory_listing_tracked(text, boolean);");
    expect(migration).toContain("drop table if exists public.inventory_tracked_listings;");
  });
});

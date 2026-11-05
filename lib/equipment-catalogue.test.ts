import { describe, expect, it } from "vitest";

import {
  defaultEquipmentFilters,
  equipmentCategoryKey,
  filterEquipment,
  getEquipmentCategories,
  readEquipmentFilters,
} from "./equipment-catalogue";
import { equipmentCatalog } from "./site-content";

function search(query: string) {
  return filterEquipment(equipmentCatalog, { ...defaultEquipmentFilters, query });
}

describe("equipment catalogue filters", () => {
  it("preserves the full catalogue and its curated order by default", () => {
    expect(filterEquipment(equipmentCatalog, defaultEquipmentFilters)).toEqual(equipmentCatalog);
  });

  it.each([
    ["  YAMAHA-DXR15  ", ["yamaha-dxr15"]],
    ["yamaha 15", ["yamaha-dxr15"]],
    ["15 yamaha", ["yamaha-dxr15"]],
    ["SM 58", ["shure-sm58"]],
    ["air 15s", ["presonus-air15s"]],
    ["wireless mic", ["k60-wireless"]],
    ["wireless mics", ["k60-wireless"]],
    ["subs", ["behringer-b1200d-pro", "presonus-air15s"]],
    ["fog", ["beamz-s1500"]],
    ["podcasting", ["shure-sm7b"]],
    ["bluetooth", ["bose-s1-pro"]],
    ["scene recall", ["hire-behringer-x32"]],
    ["x32 16", ["hire-behringer-x32"]],
  ])("matches customer search %j across names, uses, and product features", (query, expected) => {
    expect(search(query).map((item) => item.slug)).toEqual(expected);
  });

  it("does not mistake DI for the middle of audio or cardioid", () => {
    expect(search("di").map((item) => item.slug)).toEqual([
      "hire-di-box",
      "hire-generic-di-box",
      "hire-four-channel-di-box",
    ]);
  });

  it("finds lighting even when the customer searches for lights", () => {
    const matches = search("lights").map((item) => item.slug);
    expect(matches).toContain("hire-party-lights-bar");
    expect(matches).toContain("hire-party-light-par-can");
  });

  it("matches all words rather than showing unrelated partial results", () => {
    expect(search("yamaha wireless")).toEqual([]);
    expect(search("not-a-real-product")).toEqual([]);
  });

  it("handles whitespace, punctuation and accents without treating input as a regular expression", () => {
    expect(search(" \t ")).toEqual(equipmentCatalog);
    expect(search("Yámaha")).toEqual(search("yamaha"));
    expect(search("yamaha [.*]")).toEqual(search("yamaha"));
  });

  it("combines category and search filters", () => {
    expect(filterEquipment(equipmentCatalog, {
      ...defaultEquipmentFilters, category: "microphones", query: "shure",
    }).map((item) => item.slug)).toEqual(["shure-sm58", "shure-sm57", "shure-sm7b"]);
    expect(filterEquipment(equipmentCatalog, {
      ...defaultEquipmentFilters, category: "speakers", query: "smoke",
    })).toEqual([]);
  });

  it("derives every category and count from the catalogue, including effects", () => {
    const categories = getEquipmentCategories(equipmentCatalog);
    expect(categories.reduce((total, category) => total + category.count, 0)).toBe(equipmentCatalog.length);
    expect(categories).toContainEqual({ key: "effects", label: "Effects", count: 1 });
    expect(categories).toContainEqual({ key: "di-boxes", label: "DI boxes", count: 3 });
    expect(equipmentCategoryKey("DI boxes")).toBe("di-boxes");
  });

  it("sorts by the lowest-priced hire option, not the default pair price", () => {
    const results = filterEquipment(equipmentCatalog, { ...defaultEquipmentFilters, sort: "price-asc" });
    const prices = results.map((item) => Math.min(...item.options.map((option) => option.price)));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(results.findIndex((item) => item.slug === "bose-s1-pro"))
      .toBeLessThan(results.findIndex((item) => item.slug === "presonus-air15s"));
  });

  it("supports descending price and alphabetical order without mutating source data", () => {
    const original = equipmentCatalog.map((item) => item.slug);
    const descending = filterEquipment(equipmentCatalog, { ...defaultEquipmentFilters, sort: "price-desc" });
    expect(descending[0].slug).toBe("hire-behringer-x32");
    const alphabetical = filterEquipment(equipmentCatalog, { ...defaultEquipmentFilters, sort: "name" });
    expect(alphabetical.map((item) => item.name)).toEqual(
      equipmentCatalog.map((item) => item.name).sort((a, b) => a.localeCompare(b, "en-AU")),
    );
    expect(equipmentCatalog.map((item) => item.slug)).toEqual(original);
  });

  it("keeps catalogue ordering when prices tie", () => {
    const results = filterEquipment(equipmentCatalog, { ...defaultEquipmentFilters, sort: "price-asc" });
    expect(results.filter((item) => item.options[0].price === 10).map((item) => item.slug)).toEqual([
      "behringer-xm8500", "hire-generic-di-box", "hire-party-light-par-can", "hire-extension-reel-10m",
    ]);
  });

  it("reads shareable filter URLs and safely ignores unavailable filter values", () => {
    expect(readEquipmentFilters(new URLSearchParams("q=wireless&category=microphones&sort=price-asc"), equipmentCatalog))
      .toEqual({ query: "wireless", category: "microphones", sort: "price-asc" });
    expect(readEquipmentFilters(new URLSearchParams("q=smoke&category=retired&sort=unknown"), equipmentCatalog))
      .toEqual({ query: "smoke", category: "all", sort: "recommended" });
  });
});

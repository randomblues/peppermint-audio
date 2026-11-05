import { describe, expect, it } from "vitest";

import { addOnCatalog, equipmentCatalog, packageTiers } from "./site-content";

describe("equipmentCatalog", () => {
  it("includes the microphone and party bar hire items with product images", () => {
    const expectedItems = [
      ["behringer-xm8500", "/behringer-xm8500.jpg", 10],
      ["behringer-b1200d-pro", "/behringer-b1200d-pro.jpg", 50],
      ["presonus-air15s", "/presonus-air15s-front-cropped.webp", 65],
      ["shure-sm58", "/shure-sm58.jpg", 15],
      ["shure-sm57", "/shure-sm57.webp", 15],
      ["shure-sm7b", "/shure-sm7b.jpg", 35],
      ["k60-wireless", "/k60-wireless-microphone.webp", 25],
      ["beamz-s1500", "/beamz-s1500-smoke-machine.webp", 30],
      ["hire-party-lights-bar", "/cr-lite-magikbar.avif", 30],
      ["hire-behringer-x32", "/behringer-x32.jpg", 110],
      ["hire-spirit-e12-mixer", "/soundcraft-spirit-e12.jpg", 30],
      ["hire-party-light-par-can", "/par-can-generic.jpg", 10],
      ["hire-four-channel-di-box", "/dbx-di4.jpg", 20],
      ["hire-di-box", "/pro-di-box.webp", 15],
      ["hire-generic-di-box", "/generic-di-box.jpg", 10],
      ["hire-extension-reel-10m", "/10m-extension-reel.jpeg", 10],
    ] as const;

    for (const [slug, image, price] of expectedItems) {
      const item = equipmentCatalog.find((candidate) => candidate.slug === slug);

      expect(item).toMatchObject({
        image,
        options: [{ price }],
      });
    }

    expect(equipmentCatalog.find((item) => item.slug === "presonus-air15s")).toMatchObject({
      name: "PreSonus AIR15s Active Subwoofer",
      details: [
        "15-inch active subwoofer",
        "1200W peak Class D power",
        "Variable low-pass filter for matching PA speakers",
      ],
    });
    expect(equipmentCatalog.some((item) => item.slug === "hire-wireless-microphones")).toBe(false);
  });

  it("offers the BeamZ smoke machine pre-filled without specifying a fluid quantity", () => {
    expect(equipmentCatalog.find((item) => item.slug === "beamz-s1500")).toMatchObject({
      name: "BeamZ S1500 Smoke Machine",
      category: "Effects",
      options: [{ label: "Single smoke machine", price: 30 }],
      details: [
        "Supplied pre-filled with smoke liquid",
        "Makes light beams more visible for party and DJ effects",
      ],
    });
  });

  it.each(equipmentCatalog)("gives $slug useful product details instead of hire boilerplate", (item) => {
    expect(item.details.length).toBeGreaterThanOrEqual(2);
    for (const detail of item.details) {
      expect(detail.trim()).not.toBe("");
      expect(detail).not.toMatch(/availability confirmed|collected from|single (microphone|item) hire/i);
    }
    expect(item.description).not.toMatch(/add this item on its own when you only need/i);
  });

  it("uses the same product copy for add-ons listed as individual equipment", () => {
    for (const [slug, addOn] of Object.entries(addOnCatalog)) {
      if (slug === "wireless-microphones") continue;
      expect(equipmentCatalog.find((item) => item.slug === `hire-${slug}`)).toMatchObject({
        description: addOn.description,
        details: addOn.details,
      });
    }
  });

  it("keeps the speech packages distinct and uses the combined product image", () => {
    expect(packageTiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "speech-presentation-wireless",
          name: "Speech & Presentation Package",
          price: 65,
          image: "/speech-presentation-package.png",
        }),
        expect.objectContaining({
          slug: "speech-presentation",
          name: "Small Budget Event Package",
          price: 120,
          image: "/small-budget-event-package-v2.png",
        }),
        expect.objectContaining({
          slug: "standard-party-events",
          image: "/standard-party-events-package-v2.png",
        }),
        expect.objectContaining({
          slug: "budget-with-a-boom",
          name: "Budget With A Boom",
          price: 170,
          image: "/budget-with-a-boom-package-v3.png",
        }),
        expect.objectContaining({
          slug: "big-celebration",
          summary: expect.stringContaining("PreSonus AIR15s subwoofer"),
          inclusions: expect.arrayContaining([
            "1 x 15 inch PreSonus AIR15s Active Subwoofer.",
          ]),
          image: "/big-celebration-package-v3.png",
        }),
      ]),
    );
  });

  it("places the standard package before the subwoofer package", () => {
    const packageSlugs = packageTiers.map((pkg) => pkg.slug);

    expect(packageSlugs.indexOf("standard-party-events")).toBeLessThan(
      packageSlugs.indexOf("budget-with-a-boom"),
    );
  });

  it("uses customer-facing generic speech package equipment wording", () => {
    const speechPackage = packageTiers.find(
      (pkg) => pkg.slug === "speech-presentation-wireless",
    );

    expect(speechPackage).toMatchObject({
      summary: expect.stringContaining("portable Bose PA speaker and wireless microphone"),
      inclusions: [
        "1 x Portable Bose PA Speaker.",
        "1 x Wireless Microphone with receiver.",
        "Power cable for the Bose speaker.",
        "Bluetooth or AUX phone connection.",
      ],
    });
    expect(speechPackage?.summary).not.toContain("K60");
    expect(speechPackage?.inclusions.join(" ")).not.toContain("Microphone connection cable");
  });
});

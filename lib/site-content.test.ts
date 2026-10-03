import { describe, expect, it } from "vitest";

import { equipmentCatalog } from "./site-content";

describe("equipmentCatalog", () => {
  it("includes the microphone and party bar hire items with product images", () => {
    const expectedItems = [
      ["behringer-xm8500", "/behringer-xm8500.jpg", 10],
      ["shure-sm58", "/shure-sm58.jpg", 15],
      ["shure-sm57", "/shure-sm57.webp", 15],
      ["shure-sm7b", "/shure-sm7b.jpg", 35],
      ["k60-wireless", "/k60-wireless-microphone.webp", 25],
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

    expect(equipmentCatalog.some((item) => item.slug === "hire-wireless-microphones")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { getPhotoIdLiveGuidance } from "./photo-id-live-guidance";

function makeFrame(cardScale: number, options: { brightness?: number; blur?: boolean } = {}) {
  const width = 160;
  const height = 101;
  const brightness = options.brightness ?? 185;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insideCard = Math.abs(x - width / 2) <= (width * cardScale) / 2
        && Math.abs(y - height / 2) <= (height * cardScale) / 2;
      const detail = !options.blur && insideCard && (x % 9 < 2 || y % 8 < 2);
      const value = insideCard ? (detail ? 45 : brightness) : 100;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("getPhotoIdLiveGuidance", () => {
  it("prompts the customer to move closer when the ID is small in the frame", () => {
    expect(getPhotoIdLiveGuidance(makeFrame(0.55))).toMatch(/move closer/i);
  });

  it("prompts the customer to move back when the card nearly fills the frame", () => {
    expect(getPhotoIdLiveGuidance(makeFrame(0.99))).toMatch(/move back/i);
  });

  it("prompts for the ID to be placed inside the frame when no document edges are visible", () => {
    const blank = new Uint8ClampedArray(160 * 101 * 4);
    for (let index = 0; index < blank.length; index += 4) {
      blank[index] = 120;
      blank[index + 1] = 120;
      blank[index + 2] = 120;
      blank[index + 3] = 255;
    }
    expect(getPhotoIdLiveGuidance({ data: blank, width: 160, height: 101 })).toMatch(/all four edges/i);
  });

  it("gives lighting, glare and focus tips", () => {
    expect(getPhotoIdLiveGuidance(makeFrame(0.8, { brightness: 25 }))).toMatch(/more light/i);
    expect(getPhotoIdLiveGuidance(makeFrame(0.8, { brightness: 255 }))).toMatch(/glare/i);
    expect(getPhotoIdLiveGuidance(makeFrame(0.8, { blur: true }))).toMatch(/focus/i);
  });

  it("confirms a well-framed clear card", () => {
    expect(getPhotoIdLiveGuidance(makeFrame(0.8))).toMatch(/looks good/i);
  });
});

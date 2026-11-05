import { describe, expect, it } from "vitest";

import { hasPhotoIdText, unrecognizedPhotoIdMessage } from "./photo-id-ocr";

describe("hasPhotoIdText", () => {
  it.each([
    "TEXAS DRIVER LICENSE DOB 09/24/1996 4d DLN 62821123",
    "AUSTRALIAN PASSPORT SURNAME SMITH GIVEN NAMES ALEX DATE OF BIRTH",
    "PROOF OF AGE PHOTO CARD ADDRESS 10 SAMPLE STREET",
    "QUEENSLAND DRIVER LICENCE EXPIRY 12/05/2030",
  ])("recognizes ID document type and identity fields: %s", (text) => {
    expect(hasPhotoIdText(text)).toBe(true);
  });

  it.each([
    "",
    "A landscape with trees, clouds, and a mountain.",
    "A portrait of a person in front of a wall.",
    "DRIVER LICENSE",
    "NAME ADDRESS DATE OF BIRTH",
  ])("rejects images without enough ID text: %s", (text) => {
    expect(hasPhotoIdText(text)).toBe(false);
  });

  it("provides a retake instruction when ID text is not detected", () => {
    expect(unrecognizedPhotoIdMessage).toMatch(/recognize this as an ID/i);
    expect(unrecognizedPhotoIdMessage).toMatch(/try again/i);
  });
});

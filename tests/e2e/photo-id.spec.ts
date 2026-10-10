import path from "node:path";
import { expect, test } from "@playwright/test";

test("converts real HEIC photo IDs before submitting the booking", async ({ page }) => {
  await page.addInitScript(() => {
    const start = new Date();
    start.setDate(start.getDate() + 14);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    localStorage.setItem("peppermint-audio-cart", JSON.stringify([
      { id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 },
    ]));
    localStorage.setItem("peppermint-audio-hire-dates", JSON.stringify({
      pickupDate: dateValue(start), dropoffDate: dateValue(end),
    }));
    localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Disposable", lastName: "PhotoTest", email: "photo-test@example.invalid",
      mobile: "0400000000", eventType: "Test party", eventAddress: "1 Test Street",
      pickupTime: "10:00", dropoffTime: "12:00",
    }));
  });
  let convertedFiles = 0;
  await page.route("**/api/booking", async (route) => {
    const body = route.request().postDataBuffer();
    expect(body).not.toBeNull();
    expect(body!.length).toBeLessThan(3.1 * 1024 * 1024);
    const form = await new Response(new Uint8Array(body!), {
      headers: { "content-type": route.request().headers()["content-type"] },
    }).formData();
    const files = form.getAll("idFiles");
    expect(files).toHaveLength(2);
    for (const file of files) {
      expect(file).toBeInstanceOf(File);
      if (!(file instanceof File)) throw new Error("Expected a converted photo ID file.");
      expect(file.type).toBe("image/jpeg");
      expect(file.name).toMatch(/\.jpg$/);
      expect(file.size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xff, 0xd8, 0xff]);
      convertedFiles++;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ bookingReference: "PA-HEIC-TEST" }),
    });
  });
  await page.goto("/booking");
  for (let step = 0; step < 3; step++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  const fixture = path.join(process.cwd(), "tests/fixtures/synthetic-photo.heic");
  await page.locator("#photo-id-files").setInputFiles([fixture, fixture]);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit a Booking Request", exact: true }).click();
  await expect(page.getByText("Thanks — we have received your request")).toBeVisible({ timeout: 20_000 });
  expect(convertedFiles).toBe(2);
});

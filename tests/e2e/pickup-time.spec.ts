import { expect, test, type Locator } from "@playwright/test";

const viewportWidths = [360, 390, 412, 540, 768, 1024, 1280, 1920];

test("booking pickup time starts at 7:30am across supported viewports", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    const pickup = new Date();
    pickup.setDate(pickup.getDate() + 14);
    const dropoff = new Date(pickup);
    dropoff.setDate(dropoff.getDate() + 3);
    const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    localStorage.setItem("peppermint-audio-cart", JSON.stringify([{
      id: "package:standard-party-events",
      name: "Standard Party & Events Package",
      kind: "package",
      price: 160,
      quantity: 1,
    }]));
    localStorage.setItem("peppermint-audio-hire-dates", JSON.stringify({
      pickupDate: dateValue(pickup),
      dropoffDate: dateValue(dropoff),
    }));
    localStorage.removeItem("peppermint-audio-booking-draft");
  });

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Proceed with booking request" }).click();
    await page.getByLabel("First name").fill("Alex");
    await page.getByLabel("Last name").fill("Example");
    await page.getByLabel("Email").fill("alex@example.invalid");
    await page.getByLabel("Mobile number").fill("0400000000");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const pickupHint = page.getByText("Pickups are available from 7:30 am onwards.");
    await expect(pickupHint).toBeVisible();

    let pickupControl: Locator;
    if (width < 768) {
      const pickupTime = page.getByRole("combobox", { name: "Pickup time" });
      pickupControl = pickupTime;
      await expect(pickupTime).toBeVisible();
      await expect(pickupTime.locator("option", { hasText: "7:30" })).toHaveCount(1);
      await expect(pickupTime.locator("option", { hasText: "7:00" })).toHaveCount(0);
      await pickupTime.selectOption("07:30");
      await expect(pickupTime).toHaveValue("07:30");
    } else {
      const desktopTrigger = page.getByTestId("pickup-time-desktop-trigger");
      pickupControl = desktopTrigger;
      await desktopTrigger.click();
      const options = page.getByTestId("pickup-time-time-options");
      await expect(options.getByRole("button", { name: "Pickup time 7:30 AM" })).toBeVisible();
      await expect(options.getByRole("button", { name: "Pickup time 7:00 AM" })).toHaveCount(0);
      const dialogBounds = await page.getByRole("dialog").boundingBox();
      if (!dialogBounds) throw new Error("Pickup-time dialog has no visible bounds.");
      expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
      expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
      expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(width);
      expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(900);
      await options.getByRole("button", { name: "Pickup time 7:30 AM" }).click();
      await expect(page.getByTestId("pickup-time-desktop-trigger")).toContainText("7:30 AM");
    }

    const controlBounds = await pickupControl.boundingBox();
    const hintBounds = await pickupHint.boundingBox();
    if (!controlBounds || !hintBounds) throw new Error("Pickup time control or hint has no visible bounds.");
    expect(controlBounds.x).toBeGreaterThanOrEqual(0);
    expect(controlBounds.x + controlBounds.width).toBeLessThanOrEqual(width);
    expect(hintBounds.x).toBeGreaterThanOrEqual(0);
    expect(hintBounds.x + hintBounds.width).toBeLessThanOrEqual(width);

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  }

  expect(browserErrors).toEqual([]);
});

import { expect, test } from "@playwright/test";

test("booking phone verification works at supported viewport widths", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await page.addInitScript(() => {
    const pickup = new Date();
    pickup.setDate(pickup.getDate() + 14);
    const dropoff = new Date(pickup);
    dropoff.setDate(dropoff.getDate() + 3);
    const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    window.localStorage.setItem("peppermint-audio-cart", JSON.stringify([{
      id: "package:standard-party-events",
      name: "Standard Party & Events Package",
      kind: "package",
      price: 160,
      quantity: 1,
    }]));
    window.localStorage.setItem("peppermint-audio-hire-dates", JSON.stringify({
      pickupDate: dateValue(pickup),
      dropoffDate: dateValue(dropoff),
    }));
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Test",
      lastName: "Customer",
      email: "test@example.com",
      mobile: "",
    }));
    window.sessionStorage.removeItem("peppermint-audio-phone-verification-session");
  });
  await page.route("**/api/phone-verification", async (route) => {
    const request = route.request().postDataJSON() as { action: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(request.action === "send"
        ? { ok: true, challengeToken: "v".repeat(43) }
        : { ok: true, verified: true }),
    });
  });

  for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/booking", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    await expect(page.getByText("Mobile number verified.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.getByLabel("Mobile number").fill("0412345678");
    await expect(page.getByText("Mobile number verified.")).toHaveCount(0);
    await page.getByRole("button", { name: "Send verification code" }).click();
    const confirmationDialog = page.getByRole("dialog", { name: "Confirm your mobile number" });
    await expect(confirmationDialog).toContainText("0412345678");
    await confirmationDialog.getByRole("button", { name: "Send code now" }).click();
    await page.getByLabel("Verification code").fill("123456");
    await expect(page.getByText("SECURE CHECK")).toHaveCount(0);
    await page.getByRole("button", { name: "Verify number" }).click();
    await expect(page.getByText("Mobile number verified.")).toBeVisible();
    await expect(page.getByText("We’ll text a code to confirm you can receive messages at this number.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Event details" })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.bodyWidth, `Body overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.documentWidth, `Document overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  }

  expect(pageErrors).toEqual([]);
});

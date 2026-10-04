import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const routeChecks = [
  "/",
  "/packages",
  "/equipment",
  "/cart",
  "/booking",
  "/contact",
  "/how-it-works",
  "/faq",
  "/get-started",
  "/admin/login",
];

const findHorizontalOverflow = async (page: Page) => {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return {
      viewportWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  });
};

test.describe("layout and screen integrity", () => {
  for (const route of routeChecks) {
    test(`${route} renders without obvious horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("body")).toBeVisible();

      const metrics = await findHorizontalOverflow(page);
      expect(
        metrics.bodyScrollWidth <= metrics.viewportWidth + 1 &&
          metrics.documentScrollWidth <= metrics.viewportWidth + 1,
        `Unexpected horizontal scroll on ${route}. metrics=${JSON.stringify(metrics)}`,
      ).toBe(true);
    });
  }
});

test.describe("critical public flow functionality", () => {
  test("cart actions remain usable and proceed to booking", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "peppermint-audio-cart",
        JSON.stringify([
          {
            id: "package:test-package",
            name: "Test Package",
            kind: "package",
            price: 250,
            quantity: 1,
          },
        ]),
      );
      window.localStorage.removeItem("peppermint-audio-booking-draft");
    });

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Your selected hire", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit a Booking Request" })).toBeVisible();

    await page.getByRole("button", { name: "Submit a Booking Request" }).click();
    await expect(page).toHaveURL(/\/booking$/);
    await expect(page.getByText("Booking details", { exact: true })).toBeVisible();
  });

});

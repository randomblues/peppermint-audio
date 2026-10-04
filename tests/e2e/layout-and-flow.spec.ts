import { expect, test } from "@playwright/test";

const routeChecks = [
  { path: "/", heading: "Audio Rental for Melbourne Events" },
  { path: "/packages", heading: "Choose your complete PA package" },
  { path: "/equipment", heading: "Build your own equipment hire" },
  { path: "/cart", heading: "Your cart is empty" },
  { path: "/booking", heading: "Booking details" },
  { path: "/contact", heading: "Get in touch" },
  { path: "/how-it-works", heading: "How It Works" },
  { path: "/faq", heading: "Frequently Asked Questions" },
  { path: "/get-started", heading: "Get Started" },
  { path: "/admin/login", heading: "Admin login" },
];

type OverflowOffender = {
  tag: string;
  className: string;
  left: number;
  right: number;
  width: number;
};

const findHorizontalOverflow = async (page: Parameters<typeof test>[0]["page"]) => {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const elements = Array.from(document.querySelectorAll("body *"));
    const offenders: OverflowOffender[] = [];

    for (const element of elements) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;

      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        offenders.push({
          tag: element.tagName.toLowerCase(),
          className: element.className,
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
        });
      }

      if (offenders.length >= 8) break;
    }

    return {
      viewportWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });
};

test.describe("layout and screen integrity", () => {
  for (const route of routeChecks) {
    test(`${route.path} renders without obvious horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();

      const metrics = await findHorizontalOverflow(page);
      expect(
        metrics.bodyScrollWidth <= metrics.viewportWidth + 1 &&
          metrics.documentScrollWidth <= metrics.viewportWidth + 1,
        `Unexpected horizontal scroll on ${route.path}. offenders=${JSON.stringify(metrics.offenders)}`,
      ).toBe(true);
      expect(metrics.offenders, `Elements overflowing viewport on ${route.path}`).toHaveLength(0);
    });
  }
});

test.describe("critical public flow functionality", () => {
  test("cart actions remain usable and proceed to booking", async ({ page }) => {
    await page.goto("/equipment", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your selected hire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit a Booking Request" })).toBeVisible();

    await page.getByRole("button", { name: "Submit a Booking Request" }).click();
    await expect(page).toHaveURL(/\/booking$/);
    await expect(page.getByRole("heading", { name: "Booking details" })).toBeVisible();
  });

  test("booking wizard progresses cleanly and delays step 4 term errors until submit", async ({ page }) => {
    await page.goto("/booking", { waitUntil: "domcontentloaded" });

    await page.getByLabel("First name").fill("Taylor");
    await page.getByLabel("Last name").fill("Customer");
    await page.getByLabel("Email").fill("taylor@example.com");
    await page.getByLabel("Mobile number").fill("0400123456");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Event details" })).toBeVisible();
    await page.getByLabel("Event type").fill("Birthday");
    await page.getByLabel("Event address").fill("1 Smith Street, Abbotsford");

    await page.locator("#pickup-date").click();
    await page.getByRole("dialog").locator('button[aria-pressed="false"]:not([disabled])').first().click();
    await page.locator("#dropoff-date").click();
    await page.getByRole("dialog").locator('button[aria-pressed="false"]:not([disabled])').first().click();
    await page.getByRole("button", { name: "Pickup time" }).click();
    await page.getByRole("option", { name: "9:00 AM" }).click();
    await page.getByRole("button", { name: "Drop-off time" }).click();
    await page.getByRole("option", { name: "10:00 AM" }).click();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Review your hire" })).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Photo ID and terms" })).toBeVisible();
    await expect(page.getByText("Please confirm you agree to the hire terms.")).toBeHidden();

    await page.getByRole("button", { name: "Submit a Booking Request" }).click();
    await expect(page.getByText("Please confirm you agree to the hire terms.")).toBeVisible();
  });
});

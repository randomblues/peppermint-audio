import { expect, test } from "@playwright/test";

const viewportWidths = [360, 390, 412, 540, 768, 1024, 1280, 1920];

test("admin tax report controls fit supported viewport widths", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  const loginStatus = await page.evaluate(async () => {
    const response = await fetch("/api/dev/admin-login", { method: "POST" });
    return response.status;
  });
  test.skip(loginStatus !== 200, "A disposable local admin must be provisioned to test the protected tax report.");

  await page.route(/\/api\/admin\/(?:bookings|tax-report)(?:\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/tax-report")) {
      await route.fulfill({
        json: {
          summary: { invoiceCount: 0, taxableSalesCents: 0, gstIncludedCents: 0, securityDepositCents: 0, totalAmountCents: 0 },
          rows: [],
          purchaseSummary: { purchaseCount: 0, totalCostCents: 0, gstPaidCents: 0 },
          purchases: [],
        },
      });
      return;
    }
    await route.fulfill({ json: { bookings: [] } });
  });

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin#tax-report", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Tax", level: 1 })).toBeVisible();
    const runReport = page.getByRole("button", { name: "Run report" });
    await expect(runReport).toBeVisible();
    await expect(runReport).toBeEnabled();

    const bounds = await runReport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const grid = element.parentElement;
      return {
        left: rect.left,
        right: rect.right,
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        gridWidth: grid?.clientWidth ?? 0,
        gridContentWidth: grid?.scrollWidth ?? 0,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.gridContentWidth).toBeLessThanOrEqual(bounds.gridWidth + 1);
    expect(bounds.viewportWidth).toBe(width);
  }

  expect(browserErrors).toEqual([]);
});

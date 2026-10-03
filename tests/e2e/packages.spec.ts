import { expect, test } from "@playwright/test";

const packageNames = [
  "Speech & Presentation Package",
  "Small Budget Event Package",
  "Budget With A Boom",
  "Standard Party & Events Package",
  "Big Celebration Package",
];

test.describe("packages page", () => {
  test("keeps package choices usable on mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.goto("/packages");

    await expect(page.getByRole("heading", { name: "Choose your complete PA package" })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(packageNames.length);

    const dimensions = await page.locator("body").evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const tabs = page.getByRole("tab");
    const tabBoxes = await tabs.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    expect(new Set(tabBoxes.map((box) => box.top)).size).toBeGreaterThan(1);

    const card = page.locator('[data-slot="tabs-content"]:visible [data-slot="card"]');
    const tabsBottom = Math.max(...tabBoxes.map((box) => box.bottom));
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.y).toBeGreaterThan(tabsBottom);

    for (const packageName of packageNames) {
      await page.getByRole("tab", { name: packageName }).click();
      await expect(page.getByText(packageName, { exact: true }).last()).toBeVisible();
    }
  });

  test("uses the available desktop content width", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto("/packages");

    const card = page.locator('[data-slot="tabs-content"]:visible [data-slot="card"]');
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.width).toBeGreaterThan(600);
  });
});

import { expect, test } from "@playwright/test";

test("combines instant search and category filters with a useful empty-state recovery", async ({ page }) => {
  await page.goto("/equipment");
  const search = page.getByRole("textbox", { name: "Search equipment" });
  const results = page.getByRole("region", { name: "Equipment results" });
  await expect(search).toBeEnabled();

  const category = page.getByRole("combobox", { name: "Equipment category" });
  await expect(category).toBeVisible();
  await category.selectOption("speakers");
  await expect(results.getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(2);
  await search.fill("smoke");
  await expect(results.getByRole("heading", { name: "No gear found" })).toBeVisible();
  await results.getByRole("button", { name: "Search all categories (1)" }).click();
  await expect(search).toHaveValue("smoke");
  await expect(results.getByRole("link", { name: "BeamZ S1500 Smoke Machine", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=smoke/);

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(search).toHaveValue("");
  await expect(results.getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(18);
  await expect(page).toHaveURL(/\/equipment$/);
});

test("restores shared filters through reload and browser Back from product details", async ({ page }) => {
  await page.goto("/equipment?q=wireless+mic&category=microphones&sort=price-asc");
  const search = page.getByRole("textbox", { name: "Search equipment" });
  const results = page.getByRole("region", { name: "Equipment results" });
  await expect(search).toHaveValue("wireless mic");
  await expect(page.getByRole("combobox", { name: "Sort equipment" })).toHaveValue("price-asc");
  await expect(results.getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(1);
  await page.reload();
  await expect(search).toHaveValue("wireless mic");

  await results.getByRole("link", { name: "K60 Wireless Microphone", exact: true }).click();
  await expect(page).toHaveURL(/\/equipment\/k60-wireless$/);
  await page.goBack();
  await expect(search).toHaveValue("wireless mic");
  await expect(results.getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Sort equipment" })).toHaveValue("price-asc");
});

test("keeps hire options and cart prices intact when sorting and searching", async ({ page }) => {
  await page.goto("/equipment");
  const results = page.getByRole("region", { name: "Equipment results" });
  const boseCard = results.locator('[data-slot="card"]').filter({
    has: page.getByRole("link", { name: "Bose S1 Pro PA Speaker", exact: true }),
  });
  await boseCard.getByRole("button", { name: "Single speaker $55 / night" }).click();
  await expect(boseCard.getByRole("button", { name: "Single speaker $55 / night" }))
    .toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Sort equipment" }).selectOption("price-asc");
  await expect(boseCard.getByRole("button", { name: "Single speaker $55 / night" }))
    .toHaveAttribute("aria-pressed", "true");
  await boseCard.getByRole("button", { name: "Add to cart", exact: true }).click();

  await page.getByRole("textbox", { name: "Search equipment" }).fill("smoke");
  await page.getByRole("button", { name: /Open cart/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Bose S1 Pro PA Speaker", { exact: true })).toBeVisible();
  await expect(page.getByText("$55 each / night", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear cart", exact: true }).click();
  await expect(page.getByText("Your cart is empty", { exact: true })).toBeVisible();
});

test("shows responsive quantity controls and removes an item when its quantity reaches zero", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/equipment");

    const results = page.getByRole("region", { name: "Equipment results" });
    const boseCard = results.locator('[data-slot="card"]').filter({
      has: page.getByRole("link", { name: "Bose S1 Pro PA Speaker", exact: true }),
    });
    await boseCard.getByRole("button", { name: "Add to cart", exact: true }).click();

    const quantityControls = boseCard.getByRole("group", {
      name: "Bose S1 Pro PA Speaker quantity controls",
    });
    await expect(quantityControls.getByLabel("Quantity in cart: 1")).toBeVisible();
    await expect(quantityControls.getByLabel("Quantity in cart: 1")).toHaveCSS("font-weight", "400");
    const bounds = await quantityControls.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const detailsButton = boseCard.getByRole("button", { name: "View details" });
    const controlsBounds = await quantityControls.boundingBox();
    const detailsBounds = await detailsButton.boundingBox();
    expect(controlsBounds).not.toBeNull();
    expect(detailsBounds).not.toBeNull();
    const overlaps = controlsBounds!.x < detailsBounds!.x + detailsBounds!.width
      && controlsBounds!.x + controlsBounds!.width > detailsBounds!.x
      && controlsBounds!.y < detailsBounds!.y + detailsBounds!.height
      && controlsBounds!.y + controlsBounds!.height > detailsBounds!.y;
    expect(overlaps).toBe(false);
    const documentWidth = await page.locator("body").evaluate((body) => ({
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
    }));
    expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth);

    await quantityControls.getByRole("button", { name: "Add one Bose S1 Pro PA Speaker to cart" }).click();
    await expect(quantityControls.getByLabel("Quantity in cart: 2")).toBeVisible();
    await quantityControls.getByRole("button", { name: "Remove one Bose S1 Pro PA Speaker from cart" }).click();
    await expect(quantityControls.getByLabel("Quantity in cart: 1")).toBeVisible();
    await quantityControls.getByRole("button", { name: "Remove one Bose S1 Pro PA Speaker from cart" }).click();
    await expect(boseCard.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
  }

  expect(browserErrors).toEqual([]);
});

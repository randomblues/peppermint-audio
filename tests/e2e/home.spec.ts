import { expect, test } from "@playwright/test";

import { business, packageTiers } from "../../lib/site-content";

for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
  test(`reimagined homepage is usable at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    // Keep the development-only badge out of product screenshots and mobile controls.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page.getByRole("heading", { level: 1, name: business.heroHeading })).toBeVisible();
    const setup = page.getByRole("img", { name: "Microphones and a PA speaker set up on an outdoor stage" });
    await expect.poll(() => setup.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText("Packages or individual gear", { exact: true })).toBeVisible();
    await expect(page.getByText("Pickup in Abbotsford 3067", { exact: true })).toBeVisible();
    await expect(page.getByText("Setup walkthrough included", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("region", { name: "Customer reviews", exact: true }).hover();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    await page.getByRole("region", { name: business.heroHeading }).screenshot({
      path: testInfo.outputPath(`home-${width}-hero.png`),
    });

    const layout = await page.locator("main").evaluate((element) => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      clipped: Array.from(element.querySelectorAll("h1, h2, h3, p, a, button"))
        .filter((item) => item.checkVisibility())
        .filter((item) => !item.closest('section[aria-labelledby="packages-heading"], section[aria-labelledby="reviews-heading"]'))
        .filter((item) => {
          const box = item.getBoundingClientRect();
          return box.left < -1 || box.right > window.innerWidth + 1;
        })
        .map((item) => item.textContent),
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.clipped).toEqual([]);
    await expect(page.getByRole("link", { name: "Find my setup" })).toHaveAttribute("href", "/packages");
    await expect(page.getByRole("link", { name: "Let's talk about your setup" })).toHaveAttribute("href", "/contact?package=custom");
    await expect(page.getByRole("link", { name: "A few questions before the party" })).toHaveAttribute("href", "/faq");

    const packages = page.getByRole("region", { name: "A little speech. A proper boogie." });
    await packages.getByRole("button", { name: "Next package", exact: true }).click();
    await expect(packages.getByRole("button", { name: `Show ${packageTiers[1].name}`, exact: true })).toHaveAttribute("aria-current", "true");
    await packages.getByRole("button", { name: "Previous package", exact: true }).click();
    await expect(packages.getByRole("button", { name: "Previous package", exact: true })).toBeDisabled();
    await packages.getByRole("button", { name: "Add to cart", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: `Recommended add-ons for ${packageTiers[0].name}` });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      return box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 900;
    }).toBe(true);
    await expect(dialog).not.toHaveAttribute("data-starting-style");
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath(`home-${width}-cart-dialog.png`) });
    await dialog.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog).not.toBeVisible();

    if (width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Peppermint Audio" });
      await expect(menu).toBeVisible();
      await expect.poll(async () => {
        const box = await menu.boundingBox();
        return box !== null && box.x >= 0 && box.x + box.width <= width;
      }).toBe(true);
      await menu.getByRole("button", { name: "Close", exact: true }).click();
      await expect(menu).not.toBeVisible();
    } else {
      await expect(page.getByRole("navigation").getByRole("link", { name: "FAQ", exact: true })).toBeVisible();
    }

    await page.getByRole("link", { name: "Just need the speakers?" }).click();
    await expect(page).toHaveURL(/\/equipment$/);
    await page.goBack();
    await page.getByRole("link", { name: "Find my setup" }).click();
    await expect(page).toHaveURL(/\/packages$/);
    await page.goBack();
    await page.getByRole("link", { name: "Let's chat", exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

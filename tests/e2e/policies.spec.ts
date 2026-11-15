import { expect, test } from "@playwright/test";

const policies = [
  { path: "/privacy-policy", title: "Privacy Policy", count: 5, lastSection: "Your information and concerns" },
  { path: "/terms-of-hire", title: "Terms of Hire", count: 12, lastSection: "12. Agreement and authorisations" },
];

for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
  test(`approved policy pages and navigation are usable at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    for (const policy of policies) {
      await page.getByRole("contentinfo").getByRole("link", { name: policy.title }).click();
      await expect(page).toHaveURL(new RegExp(`${policy.path}$`));
      await expect(page.getByRole("heading", { level: 1, name: policy.title })).toBeVisible();
      // Check document metadata independently of Next's retained client-navigation tags.
      const response = await page.goto(policy.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(`${policy.title} | Peppermint Audio`);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.peppermintaudio.com.au${policy.path}`);
      const contents = page.getByRole("navigation", { name: "On this page" });
      await expect(contents.getByRole("link")).toHaveCount(policy.count);
      const article = page.getByRole("article", { name: policy.title });
      await expect(article.getByText(/review-only|review notes|not approved|legal compliance certification|refresh token/i)).toHaveCount(0);
      await expect(article.getByRole("link", { name: "contactus@peppermintaudio.com.au" })).toHaveAttribute("href", "mailto:contactus@peppermintaudio.com.au");
      await expect(article.getByRole("link", { name: "0452 316 823" })).toHaveAttribute("href", "tel:0452316823");
      if (policy.path === "/terms-of-hire") {
        await expect(article.getByText(/Nothing in these terms excludes, restricts or modifies/)).toBeVisible();
        await expect(article.getByText(/We are not liable for injury, damage, or loss of event time/)).toHaveCount(0);
      }
      const lastLink = contents.getByRole("link", { name: policy.lastSection });
      await lastLink.focus();
      await page.keyboard.press("Enter");
      const lastSection = article.locator(`#section-${policy.count}`);
      await expect(lastSection.getByRole("heading", { name: policy.lastSection })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`${policy.title.replaceAll(" ", "-")}-${width}.png`), fullPage: true });

      const layout = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        clipped: Array.from(document.querySelectorAll("main h1, main h2, main p, main a, footer a"))
          .filter((element) => element.checkVisibility())
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.left < -1 || box.right > window.innerWidth + 1;
          })
          .map((element) => element.textContent),
        overlaps: Array.from(document.querySelectorAll("article section"))
          .flatMap((section) => {
            const blocks = Array.from(section.querySelectorAll("h2, p"));
            return blocks.slice(1).filter((element, index) =>
              element.getBoundingClientRect().top < blocks[index].getBoundingClientRect().bottom - 1,
            ).map((element) => element.textContent);
          }),
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.clipped).toEqual([]);
      expect(layout.overlaps).toEqual([]);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    if (width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Peppermint Audio" });
      await expect(menu).toBeVisible();
      await expect.poll(async () => {
        const box = await menu.boundingBox();
        return box ? box.x + box.width : Number.POSITIVE_INFINITY;
      }).toBeLessThanOrEqual(width + 1);
      expect((await menu.boundingBox())?.x).toBeGreaterThanOrEqual(-1);
      await menu.locator('a[href="/contact"]').click();
      await expect(menu).not.toBeVisible();
    } else {
      await page.getByRole("navigation").getByRole("link", { name: "Contact", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/contact$/);
    await page.getByLabel("Name", { exact: true }).fill("Policy Test");
    await page.getByLabel("Email", { exact: true }).fill("policy-test@example.com");
    await expect(page.getByRole("button", { name: "Send enquiry" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

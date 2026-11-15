import { expect, test } from "@playwright/test";
import { emailDetailsTable, emailLayout, emailPanel } from "../../lib/email-template";

const templates = [
  {
    eyebrow: "New booking request",
    title: "A new request needs review",
    intro: "A customer has submitted a booking request with photo ID. Review availability before confirming it.",
  },
  {
    eyebrow: "Booking received",
    title: "Thanks for your request",
    intro: "We have received your booking request and photo ID. Your request is not confirmed yet; our team will review availability and be in touch shortly.",
  },
];

for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
  test(`email previews remain hidden and booking emails render at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/logo-white.png", (route) => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="190" height="50"><text y="30" fill="white">Peppermint Audio</text></svg>',
    }));

    for (const template of templates) {
      const html = emailLayout({
        ...template,
        content: emailPanel(emailDetailsTable([
          { label: "Booking Reference:", value: "PA-EXAMPLE" },
          { label: "Customer", value: "Disposable Test" },
          { label: "Pickup", value: "16 November 2026 at 10:00" },
        ])),
      });
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`);

      const preheader = page.locator('body > div[aria-hidden="true"]');
      await expect(preheader).toBeHidden();
      await expect(preheader).toContainText(`${template.eyebrow} ${template.title} ${template.intro}`);
      await expect(page.getByRole("heading", { name: template.title })).toBeVisible();
      await expect(page.getByText(template.intro, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "0452 316 823" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      const cells = page.locator("td");
      for (let index = 0; index < await cells.count(); index += 2) {
        const label = await cells.nth(index).boundingBox();
        const value = await cells.nth(index + 1).boundingBox();
        expect(label).not.toBeNull();
        expect(value).not.toBeNull();
        expect(label!.x + label!.width).toBeLessThanOrEqual(value!.x + 1);
        expect(value!.x + value!.width).toBeLessThanOrEqual(width);
      }
      await page.screenshot({ path: testInfo.outputPath(`${template.eyebrow.replaceAll(" ", "-")}-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

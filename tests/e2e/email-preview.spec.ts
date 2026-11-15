import path from "node:path";
import { expect, test } from "@playwright/test";
import { emailDetailsTable, emailLayout, emailPanel } from "../../lib/email-template";
import { buildPickupReminderEmail } from "../../lib/pickup-reminders";
import { buildBookingConfirmationEmail } from "../../lib/booking-confirmation-email";
import type { BookingLineItem } from "../../lib/booking-line-items";

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
      contentType: "image/png",
      path: path.join(process.cwd(), "public/logo-white.png"),
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

    const hireItems: BookingLineItem[] = [{
      id: "package:speech-presentation",
      kind: "package",
      name: "Speech & Presentation Package",
      quantity: 1,
      unitPriceCents: 6500,
    }];
    const pickupInstructions = {
      hire_line_items: hireItems,
      additional_details: null,
    };
    const pickupEmails = [
      buildPickupReminderEmail({
        ...pickupInstructions,
        email: "disposable@example.invalid",
        first_name: "Alex",
        last_name: "Test",
        event_type: "Presentation",
        pickup_date: "2026-11-16",
        pickup_time: "10:00",
      }, { tomorrow: false }),
      buildBookingConfirmationEmail({
        firstName: "Alex",
        eventType: "Presentation",
        pickupDate: "16 November 2026",
        dropoffDate: "17 November 2026",
        hireLineItems: hireItems,
        pickupInstructions,
      }),
    ];
    for (const [index, email] of pickupEmails.entries()) {
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${email.html}</body></html>`);

      await expect(page.getByText(/30 minutes before arriving/i)).toHaveCount(0);
      await expect(page.getByText(/Please respect the property and call upon arrival/)).toBeVisible();
      await expect(page.getByText("Hire items", { exact: true })).toHaveCount(1);
      await expect(page.getByText("Speech & Presentation Package")).toHaveCount(1);
      await expect(page.getByText("Please make sure your vehicle has enough space for your hire, especially large PA speakers or other bulky equipment.", { exact: true })).toBeVisible();
      await expect(page.getByText("Unsure it will fit? Message or call us and we can help you check.", { exact: true })).toBeVisible();
      await expect(page.getByText(/subwoofer/i)).toHaveCount(0);
      await expect(page.getByText("We're happy to lend a hand with loading. Please remember that safe transport and handling after pickup are your responsibility.", { exact: true })).toBeVisible();
      await expect(page.getByText("Please bring suitable transport and valid photo ID for pickup.", { exact: true })).toHaveCount(0);
      if (index === 0) {
        await expect(page.getByText("Pickup reminder", { exact: true })).toHaveCount(0);
        const contactBlock = page.locator("table").locator("..");
        await expect(contactBlock).toContainText("Pickup address");
        await expect(contactBlock).toContainText("0452 316 823");
        await expect(contactBlock).toContainText("Please respect the property and call upon arrival.");
        await expect(contactBlock).not.toContainText("Hire items");
        const itemsBlock = page.locator("div").filter({ has: page.getByText("Hire items", { exact: true }) }).last();
        await expect(itemsBlock).toContainText("1 x Speech & Presentation Package");
        const contactBounds = await contactBlock.boundingBox();
        const itemsBounds = await itemsBlock.boundingBox();
        expect(contactBounds).not.toBeNull();
        expect(itemsBounds).not.toBeNull();
        expect(itemsBounds!.y).toBeGreaterThanOrEqual(contactBounds!.y + contactBounds!.height);
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('body > div[aria-hidden="true"]')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`pickup-email-${index}-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

import { expect, test } from "@playwright/test";

const publicRoutes = [
  { path: "/", heading: "Good sound. Less stress." },
  { path: "/packages", heading: "Choose your complete PA package" },
  { path: "/how-it-works", heading: "How It Works" },
  { path: "/faq", heading: "Good sound. Less stress." },
  { path: "/contact", heading: "Get in touch" },
];

test.describe("public pages", () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();

      const dimensions = await page.locator("body").evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }
});

test.describe("navigation", () => {
  test("desktop navigation reaches every primary page", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto("/", { waitUntil: "domcontentloaded" });

    for (const route of publicRoutes.slice(1)) {
      if (route.path === "/packages") {
        await page.getByRole("navigation").getByRole("button", { name: "Products" }).click();
        await page.locator('a[href="/packages"]:visible').last().click();
      } else {
        await page.getByRole("navigation").locator(`a[href="${route.path}"]`).click();
      }
      await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await page.goto("/", { waitUntil: "domcontentloaded" });
    }
  });

  test("mobile navigation opens and links to FAQ", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.goto("/");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileMenu = page.getByRole("dialog", { name: "Peppermint Audio" });
    await expect(mobileMenu).toBeVisible();
    await mobileMenu.locator('a[href="/faq"]').click();
    await expect(page).toHaveURL(/\/faq$/);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { level: 1, name: "Good sound. Less stress." })).toBeVisible();
  });
});

test.describe("FAQ page", () => {
  test("expands a question and shows its answer", async ({ page }) => {
    await page.goto("/faq");

    const question = page.getByRole("button", { name: "I've got a very specific requirement though. Can you help?" });
    await question.click();
    await expect(
      page.getByText("Maybe Joe mama's neighbour's third kid", { exact: false }),
    ).toBeVisible();
  });

  for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
    test(`FAQ is usable at ${width}px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium");
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto("/faq");
      // The development-only badge overlaps the mobile menu; errors are still collected above.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const faq = page.getByRole("region", { name: "Good sound. Less stress." });
      await expect(faq.getByRole("button")).toHaveCount(5);
      await expect(faq.getByRole("button").first()).toHaveAttribute("aria-expanded", "true");
      await page.screenshot({ path: testInfo.outputPath(`faq-${width}-initial.png`), fullPage: true });

      for (const question of await faq.getByRole("button").all()) {
        const wasExpanded = await question.getAttribute("aria-expanded") === "true";
        await question.click();
        await expect(question).toHaveAttribute("aria-expanded", wasExpanded ? "false" : "true");
      }
      await expect(faq.getByText('Before you message us saying "How much for just two speakers?"', { exact: false })).toBeVisible();
      await expect(faq.getByRole("link", { name: "Have a browse of the individual gear" })).toHaveAttribute("href", "/equipment");
      const practical = faq.locator("summary");
      await practical.focus();
      await page.keyboard.press("Enter");
      await expect(faq.locator("details")).toHaveAttribute("open", "");
      await faq.getByRole("button", { name: "What if I need the gear for more than one night?" }).click();
      await expect(faq.getByRole("link", { name: "See your hire total in the cart" })).toBeVisible();
      await expect(faq.locator('[data-slot="accordion-content"]:visible').last()).not.toHaveAttribute("data-starting-style");
      await faq.evaluate(async (element) => {
        await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`faq-${width}-expanded.png`), fullPage: true });

      const bounds = await faq.evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        clipped: Array.from(element.querySelectorAll("button, a, summary, p, h1, h2"))
          .filter((item) => item.checkVisibility())
          .filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.left < 0 || rect.right > window.innerWidth + 1;
          })
          .map((item) => item.textContent),
      }));
      expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
      expect(bounds.clipped).toEqual([]);
      if (width < 768) {
        await page.getByRole("button", { name: "Open menu" }).click();
        const menu = page.getByRole("dialog", { name: "Peppermint Audio" });
        await expect(menu).toBeVisible();
        await expect.poll(async () => {
          const box = await menu.boundingBox();
          return box ? box.x + box.width : Number.POSITIVE_INFINITY;
        }).toBeLessThanOrEqual(width);
        expect((await menu.boundingBox())?.x).toBeGreaterThanOrEqual(0);
        await menu.locator('a[href="/faq"]').click();
        await expect(menu).not.toBeVisible();
      } else {
        await expect(page.getByRole("navigation").getByRole("link", { name: "FAQ", exact: true })).toBeVisible();
      }
      await faq.getByRole("link", { name: "Get in touch" }).click();
      await expect(page).toHaveURL(/\/contact$/);
      await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe("contact form", () => {
  test("preselects a package from the URL", async ({ page }) => {
    await page.goto("/contact?package=big-celebration");

    await expect(page.getByText("Tell us about your Big Celebration Package hire", { exact: false })).toBeVisible();
  });

  test("shows validation errors for an empty submission", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByText("Please enter your name")).toBeVisible();
    await expect(page.getByText("Please enter a valid email")).toBeVisible();
    await expect(page.getByText("Please select an event date")).toBeVisible();
    await expect(page.getByText("Please share a few event details")).toBeVisible();
  });

  test("selects a date and submits a valid enquiry", async ({ page }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        if (typeof input === "string" && input === "/api/enquiry") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return originalFetch(input, init);
      };
    });
    await page.goto("/contact");

    await page.getByLabel("Name").fill("Taylor Customer");
    await page.getByLabel("Email").fill("taylor@example.com");
    await page.getByLabel("Phone").fill("0400123456");
    await page.getByLabel("Event Type").fill("Birthday party");
    await page.getByLabel("Event Details").fill("A birthday party requiring speakers and a microphone.");

    await page.locator("#eventDate").click();
    await page
      .getByRole("dialog")
      .locator('button[aria-pressed="false"]:not([disabled])')
      .first()
      .click();

    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("Enquiry sent", { exact: true })).toBeVisible();
  });
});

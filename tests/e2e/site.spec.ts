import { expect, test } from "@playwright/test";

const publicRoutes = [
  { path: "/", heading: "Audio Rental for Melbourne Events" },
  { path: "/packages", heading: "Choose your complete PA package" },
  { path: "/how-it-works", heading: "How It Works" },
  { path: "/faq", heading: "Frequently Asked Questions" },
  { path: "/contact", heading: "Get a Quote" },
];

test.describe("public pages", () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path);

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
    await page.goto("/");

    for (const route of publicRoutes.slice(1)) {
      await page.getByRole("navigation").locator(`a[href="${route.path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await page.goto("/");
    }
  });

  test("mobile navigation opens and links to FAQ", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.goto("/");

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "FAQ" }).last().click();
    await expect(page).toHaveURL(/\/faq$/);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Frequently Asked Questions", { exact: true })).toBeVisible();
  });
});

test.describe("FAQ page", () => {
  test("expands a question and shows its answer", async ({ page }) => {
    await page.goto("/faq");

    const question = page.getByRole("button", { name: "What packages are available?" });
    await question.click();
    await expect(
      page.getByText("There are three complete, ready-to-use packages:", { exact: false }),
    ).toBeVisible();
  });
});

test.describe("contact form", () => {
  test("preselects a package from the URL", async ({ page }) => {
    await page.goto("/contact?package=big-celebration");

    await expect(page.locator("#packageInterest")).toContainText("Big Celebration Package");
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
    await page.getByLabel("Estimated Guests").fill("60");
    await page.getByLabel("Event Details").fill("A birthday party requiring speakers and a microphone.");

    await page.locator("#eventDate").click();
    await page.getByRole("dialog").locator('button[aria-pressed="false"]').first().click();

    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText("Enquiry sent", { exact: true })).toBeVisible();
  });
});

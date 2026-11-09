import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createHireCalendarEvent } from "../../lib/booking-calendar";
import { getMelbourneTomorrow } from "../../lib/pickup-reminders";

test("private customer calendar offers both events and formats at every supported width", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const token = randomBytes(16).toString("base64url");
  const bookingId = randomUUID();
  const status = JSON.parse(execFileSync(path.resolve("node_modules/.bin/supabase"), [
    "status", "-o", "json", "--workdir", path.resolve(".local-supabase"),
  ], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }));
  if (new URL(status.API_URL).hostname !== "127.0.0.1" || new URL(status.DB_URL).hostname !== "127.0.0.1") {
    throw new Error("Calendar browser tests require this worktree's local-only Supabase stack.");
  }
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pickupDate = getMelbourneTomorrow();
  const dropoffDate = new Date(Date.parse(`${pickupDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const events = [
    createHireCalendarEvent("pickup", pickupDate, "10:00"),
    createHireCalendarEvent("dropoff", dropoffDate, "18:00"),
  ];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const inserted = await admin.from("bookings").insert({
    id: bookingId, calendar_token: token, status: "confirmed",
    email: "calendar-test@example.invalid", first_name: "Disposable", last_name: "Calendar Test", mobile: "0400000000",
    event_type: "Local calendar test", event_address: "Local test only",
    pickup_date: pickupDate, pickup_time: "10:00", dropoff_date: dropoffDate, dropoff_time: "18:00",
    hire_line_items: [], terms_accepted: true,
  });
  if (inserted.error) throw new Error(`Local calendar fixture could not be saved: ${inserted.error.message}`);
  try {
    const response = await page.request.get(`/api/calendar/${token}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const json = await response.json();
    expect(Object.keys(json).sort()).toEqual(["events", "reference"]);
    expect(json.events.map((event: { kind: string }) => event.kind)).toEqual(["pickup", "dropoff"]);
  for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/calendar/${token}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Add your hire to your calendar" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByRole("article", { name: "Pickup calendar event" })).toContainText("10:00 am");
    await expect(page.getByRole("article", { name: "Drop-off calendar event" })).toContainText("6:00 pm");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    for (const event of events) {
      const card = page.getByRole("article", { name: event.kind === "pickup" ? "Pickup calendar event" : "Drop-off calendar event" });
      const google = card.getByRole("link", { name: /Google Calendar/ });
      await google.scrollIntoViewIfNeeded();
      await expect(google).toBeVisible();
      await expect(google).toHaveAttribute("href", event.googleUrl);
      await expect(google).toHaveAttribute("rel", "noopener noreferrer");
      const apple = card.getByRole("link", { name: /Apple \/ Outlook/ });
      await apple.scrollIntoViewIfNeeded();
      await expect(apple).toBeVisible();
      const download = page.waitForEvent("download");
      await apple.click();
      const file = await download;
      expect(file.suggestedFilename()).toBe(`peppermint-audio-${event.kind}.ics`);
      const savedPath = await file.path();
      if (!savedPath || !event.startsAt) throw new Error("The timed calendar download is missing.");
      const contents = readFileSync(savedPath, "utf8");
      expect(contents).toContain("BEGIN:VCALENDAR\r\n");
      expect(contents).toContain(`SUMMARY:${event.title}\r\n`);
      expect(contents).toContain(`DTSTART:${event.startsAt.replace(/[-:]/g, "").replace(".000", "")}\r\n`);
    }
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth,
      clipped: Array.from(document.querySelectorAll("article, article p, article a, h1")).filter(
        element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1,
      ).map(element => element.tagName),
      overlapping: (() => {
        const cards = Array.from(document.querySelectorAll("article")).map(element => element.getBoundingClientRect());
        return cards.length === 2 && cards[0].right > cards[1].left && cards[0].bottom > cards[1].top;
      })(),
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.clipped).toEqual([]);
    expect(layout.overlapping).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`booking-calendar-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "Call 0452 316 823" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: "Call 0452 316 823" })).toHaveAttribute("href", "tel:0452316823");
  }
  expect(errors).toEqual([]);
  } finally {
    const cleanup = await admin.from("bookings").delete().eq("id", bookingId);
    if (cleanup.error) throw new Error(`Local calendar fixture could not be removed: ${cleanup.error.message}`);
  }
});

import { expect, test } from "@playwright/test";
import { buildDepositAttentionSms, buildPickupReminderSms, buildDropoffReminderSms } from "../../lib/sms-messages";
import { melbourneDateKey } from "../../lib/payment-flow";
import { getMelbourneTomorrow } from "../../lib/pickup-reminders";

test("admin communication history shows email and SMS at all supported widths", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  const loginStatus = await page.evaluate(async () => (await fetch("/api/dev/admin-login", { method: "POST" })).status);
  expect(loginStatus, "A disposable local admin is required for protected UI validation.").toBe(200);

  const now = new Date();
  const pickupDate = melbourneDateKey(now);
  const booking = {
    id: "00000000-0000-4000-8000-000000000001",
    first_name: "Test", last_name: "Communications", email: "comms@example.invalid", mobile: "0400000000",
    status: "confirmed", event_type: "Test event", pickup_date: pickupDate, dropoff_date: pickupDate,
    pickup_time: "10:00", dropoff_time: "18:00", created_at: now.toISOString(), hire_line_items: [],
    email_logs: [{
      id: "email-one", email_type: "confirmation", recipient_email: "comms@example.invalid",
      provider_message_id: "email-provider-one", sent_at: new Date(now.getTime() - 1000).toISOString(),
    }],
    sms_logs: [
      { id: "sms-one", sms_type: "pickup_reminder", recipient_mobile: "+61400000000", body: buildPickupReminderSms({ pickup_date: pickupDate, pickup_time: "10:00" }),
        status: "accepted", provider_message_id: "sms-provider-" + "a".repeat(80), error: null, recorded_at: now.toISOString() },
      { id: "sms-two", sms_type: "deposit_attention", recipient_mobile: "+61400000000",
        body: buildDepositAttentionSms({ deposit_payment_status: "failed", deposit_error: "[decline_code: insufficient_funds]" }),
        status: "failed", provider_message_id: null, error: "SMS provider rejected the request (503).",
        recorded_at: new Date(now.getTime() - 2000).toISOString() },
      { id: "sms-dropoff", sms_type: "dropoff_reminder", recipient_mobile: "+61400000000",
        body: buildDropoffReminderSms({ dropoff_date: pickupDate, dropoff_time: "18:00" }, now),
        status: "accepted", provider_message_id: "sms-dropoff-1", error: null,
        recorded_at: new Date(now.getTime() - 3000).toISOString() },
    ],
  };
  await page.route(/\/api\/admin\/bookings(?:\?|$)/, route => route.fulfill({ json: { bookings: [booking] } }));
  await page.route(/\/api\/admin\/email-history\?/, route => route.fulfill({ json: { email: {
    id: "email-one", subject: "Test confirmation", from: "team@example.invalid", to: [booking.email],
    created_at: now.toISOString(), html: "<h1>Test confirmation email</h1>", text: "Test confirmation email",
    attachments: [], attachmentsArchived: true,
  } } }));

  await page.goto("/admin#bookings", { waitUntil: "domcontentloaded" });
  for (const width of [360, 390, 412, 540, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const bookingButton = page.getByRole("button", { name: /Test Communications comms@example.invalid/ });
    await expect(bookingButton).toBeVisible();
    await bookingButton.click();
    const dialog = page.getByRole("dialog", { name: "Test Communications" });
    const communications = dialog.getByRole("button", { name: /Communications/ });
    await communications.click();
    await expect(communications).toHaveAttribute("aria-expanded", "true");
    const history = dialog.getByRole("list", { name: "Communication history" });
    await expect(history.getByRole("listitem")).toHaveCount(4);
    await expect(history.getByRole("listitem").nth(0)).toContainText("SMS · Accepted by provider");
    await expect(history.getByRole("listitem").nth(1)).toContainText("View sent email");
    await expect(history.getByRole("listitem").nth(2)).toContainText("SMS · Failed");
    const pickupSms = history.getByRole("article", { name: "Pickup reminder SMS" });
    await expect(pickupSms).toContainText("Peppermint Audio: Hi! Your pickup is today at 10:00 AM, as requested.");
    await expect(pickupSms).not.toContainText("photo ID");
    await expect(pickupSms).toContainText("Please bring suitable transport in case you're collecting larger equipment.");
    await expect(pickupSms).toContainText("Peppermint Audio is a small business operating from a private residence.");
    await expect(pickupSms).toContainText("message or call 0452 316 823 upon arrival. In case you're running late or need to change your scheduled pickup time, please contact us beforehand.");
    await expect(pickupSms).not.toContainText("30 mins");
    const dropoffSms = history.getByRole("article", { name: "Drop-off reminder SMS" });
    await expect(dropoffSms).toContainText("Your equipment drop-off is today at 6:00 PM");
    await expect(dropoffSms).toContainText("Please check that all hired equipment, cables and accessories are accounted for and packed before returning them.");
    await expect(dropoffSms).not.toContainText("181 Nicholson St");
    await expect(dropoffSms).toContainText("to avoid a late drop-off fee.");
    await expect(dropoffSms).not.toContainText("residence");
    await expect(history.getByRole("article", { name: "Security deposit alert SMS" })).toContainText("insufficient funds");
    const sms = history.getByRole("article", { name: "Security deposit alert SMS" });
    await sms.scrollIntoViewIfNeeded();
    await expect(sms).toBeVisible();
    await expect(sms).toContainText("+61400000000");
    await expect(sms).toContainText("SMS provider rejected the request (503).");

    const bounds = await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const overflowing = Array.from(element.querySelectorAll("article, article p, article span, button")).filter(child =>
        child.clientWidth > 0 && child.scrollWidth > child.clientWidth + 1,
      ).map(child => child.tagName);
      return {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: document.documentElement.clientWidth, pageWidth: document.documentElement.scrollWidth,
        contentWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowing,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    expect(bounds.overflowing, `Clipped SMS text at ${width}px`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`communications-${width}.png`) });

    await history.getByRole("button", { name: "View Booking confirmation sent email" }).click();
    await expect(dialog.getByRole("heading", { name: "Sent email", exact: true })).toBeVisible();
    await expect(dialog.frameLocator('iframe[title="Rendered Booking confirmation email"]').getByRole("heading", { name: "Test confirmation email" })).toBeVisible();
    await dialog.getByRole("button", { name: "Back to communication history" }).click();
    await expect(dialog.getByRole("article", { name: "Security deposit alert SMS" })).toBeVisible();
    await dialog.getByRole("button", { name: "Send Email", exact: true }).click();
    const emailDialog = page.getByRole("dialog", { name: "Send an email" });
    await expect(emailDialog.getByLabel("Email subject")).toBeEditable();
    await emailDialog.getByLabel("Email subject").fill("Disposable test draft");
    await emailDialog.getByRole("button", { name: "Close email dialog" }).click();
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(bookingButton).toBeVisible();

    booking.sms_logs[0].body = buildPickupReminderSms({ pickup_date: getMelbourneTomorrow(now), pickup_time: "07:30" }, now);
    booking.sms_logs[2].body = buildDropoffReminderSms({ dropoff_date: getMelbourneTomorrow(now), dropoff_time: "08:00" }, now);
    await page.reload({ waitUntil: "domcontentloaded" });
    await bookingButton.click();
    await dialog.getByRole("button", { name: /Communications/ }).click();
    await expect(dialog.getByRole("article", { name: "Pickup reminder SMS" }))
      .toContainText("Peppermint Audio: Hi! Your pickup is tomorrow at 7:30 AM, as requested.");
    await expect(dialog.getByRole("article", { name: "Drop-off reminder SMS" }))
      .toContainText("Your equipment drop-off is tomorrow at 8:00 AM");
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await dialog.getByRole("button", { name: "Close details" }).click();
    booking.sms_logs[0].body = buildPickupReminderSms({ pickup_date: pickupDate, pickup_time: "10:00" }, now);
    booking.sms_logs[2].body = buildDropoffReminderSms({ dropoff_date: pickupDate, dropoff_time: "18:00" }, now);
  }
  expect(errors).toEqual([]);
});

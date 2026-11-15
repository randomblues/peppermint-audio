import { emailFooterText } from "@/lib/email-footer";
import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { lineItemsForBooking, type BookingLineItem } from "@/lib/booking-line-items";

export function getPickupResidenceNotice(contactMethod: "call" | "message" | "message or call" = "call") {
  return `Peppermint Audio is a small business operating from a private residence. Please respect the property and ${contactMethod} upon arrival.`;
}

export type PickupReminderBooking = {
  email: string;
  first_name: string;
  last_name: string;
  event_type: string;
  pickup_date: string;
  pickup_time?: string | null;
  hire_line_items: BookingLineItem[] | null;
  additional_details: string | null;
};

export type PickupInstructionSource = Pick<PickupReminderBooking, "hire_line_items" | "additional_details">;

export function getMelbourneTomorrow(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const date = new Date(Date.UTC(
    Number(parts.find((part) => part.type === "year")?.value),
    Number(parts.find((part) => part.type === "month")?.value) - 1,
    Number(parts.find((part) => part.type === "day")?.value) + 1,
  ));
  return date.toISOString().slice(0, 10);
}

export function formatMelbourneDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function getPickupInstructions(booking: PickupInstructionSource) {
  const hireItems = lineItemsForBooking({ hire_line_items: booking.hire_line_items });
  return {
    hireItems: hireItems.map((item) => `${item.quantity} x ${item.name}${item.option ? ` (${item.option})` : ""}`),
    additionalDetails: booking.additional_details?.trim() ?? "",
    transportText: [
      "Please make sure your vehicle has enough space for your hire, especially large PA speakers or other bulky equipment.",
      "Unsure it will fit? Message or call us and we can help you check.",
      "We're happy to lend a hand with loading. Please remember that safe transport and handling after pickup are your responsibility.",
    ],
  };
}

export function buildPickupReminderEmail(booking: PickupReminderBooking, options: { tomorrow?: boolean } = {}) {
  const { hireItems, additionalDetails, transportText } = getPickupInstructions(booking);
  const pickupDate = formatMelbourneDate(booking.pickup_date);
  const pickupTime = booking.pickup_time ? ` at ${booking.pickup_time}` : "";
  const additionalText = additionalDetails
    ? [
      "Additional requirements:",
      additionalDetails,
      "Please confirm these requirements with Peppermint Audio at pickup. Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.",
    ]
    : "";
  const text = [
    `Hi ${booking.first_name}. Your pickup is ${options.tomorrow === false ? "on" : "tomorrow,"} ${pickupDate}${pickupTime}.`,
    "",
    "Here are your pickup details:",
    `Pickup address: 181 Nicholson St, Abbotsford VIC 3067`,
    "Phone: 0452 316 823",
    `Please note: ${getPickupResidenceNotice()}`,
    "",
    "Hire items:",
    ...(hireItems.length ? hireItems.map((item) => `- ${item}`) : ["- None specified"]),
    "",
    "Transport and handling:",
    ...transportText,
    "",
    additionalText,
    "",
    emailFooterText,
  ].filter(Boolean).join("\n");
  const hireItemsList = `<ul style="margin:10px 0 0;padding-left:20px;color:#405148;font-size:14px;line-height:1.7">${(hireItems.length ? hireItems : ["None specified"]).map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul>`;
  const transportList = `<ul style="margin:10px 0 0;padding-left:20px;color:#405148;font-size:14px;line-height:1.7">${transportText.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul>`;
  const additionalPanel = additionalDetails
    ? emailPanel(`<p style="margin:0 0 8px;color:#1d2823;font-size:15px;font-weight:700">Additional requirements</p><p style="margin:0;color:#405148;font-size:14px;line-height:1.65;white-space:pre-line">${escapeEmailHtml(additionalDetails)}</p><p style="margin:12px 0 0;color:#405148;font-size:13px;line-height:1.6"><strong>Please confirm these requirements at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed requirements.</p>`, "soft")
    : "";
  const html = emailLayout({
    title: options.tomorrow === false ? "Your pickup details" : "Your pickup is tomorrow",
    intro: `Hi ${escapeEmailHtml(booking.first_name.trim()) || "there"}, please review the details below for ${escapeEmailHtml(pickupDate)}${escapeEmailHtml(pickupTime)}.`,
    content: `
      ${emailPanel(emailDetailsTable([
        { label: "Pickup address", value: "181 Nicholson St, Abbotsford VIC 3067" },
        { label: "Phone", value: "0452 316 823" },
      ]) + `<p style="margin:16px 0 0;color:#405148;font-size:14px;line-height:1.6"><strong>Please note:</strong> ${escapeEmailHtml(getPickupResidenceNotice())}</p>`, "accent")}
      ${emailPanel(`<p style="margin:0;color:#1d2823;font-size:15px;font-weight:700">Hire items</p>${hireItemsList}`, "soft")}
      ${emailPanel(`<p style="margin:0;color:#1d2823;font-size:15px;font-weight:700">Transport and handling</p>${transportList}`, "soft")}
      ${additionalPanel}
    `,
  });
  return { subject: `Pickup reminder for ${pickupDate} — Peppermint Audio`, text, html };
}

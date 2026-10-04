import { emailFooterText } from "@/lib/email-footer";
import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { lineItemsForBooking, type BookingLineItem } from "@/lib/booking-line-items";

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

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function getPickupInstructions(booking: PickupInstructionSource) {
  const hireItems = lineItemsForBooking({ hire_line_items: booking.hire_line_items });
  return {
    hireItems: hireItems.map((item) => `${item.quantity} x ${item.name}${item.option ? ` (${item.option})` : ""}`),
    additionalDetails: booking.additional_details?.trim() ?? "",
    transportText: [
      "Please make sure there is adequate space in your transport when collecting the equipment.",
      "For the smaller packages, a sedan with an empty boot or folded-down rear seats should generally be suitable.",
      "The Big Celebration package includes a subwoofer and requires additional space. The same applies if a subwoofer has been selected as an add-on.",
      "Help will be provided on site to load the equipment, but the hirer is responsible for transporting and safely handling it after pickup.",
    ],
  };
}

export function buildPickupReminderEmail(booking: PickupReminderBooking) {
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
    `Hi ${booking.first_name}. Your pickup is tomorrow, ${pickupDate}${pickupTime}.`,
    "",
    "Here are your pickup details:",
    "Hire items:",
    ...(hireItems.length ? hireItems.map((item) => `- ${item}`) : ["- None specified"]),
    `Pickup address: 181 Nicholson St, Abbotsford VIC 3067`,
    "Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.",
    "",
    "Please note: Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.",
    "",
    "Transport and handling:",
    ...transportText,
    "",
    additionalText,
    "",
    "Please bring suitable transport and valid photo ID for pickup.",
    "",
    emailFooterText,
  ].filter(Boolean).join("\n");
  const hireItemsList = `<ul style="margin:10px 0 0;padding-left:20px;color:#405148;font-size:14px;line-height:1.7">${(hireItems.length ? hireItems : ["None specified"]).map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul>`;
  const transportList = `<ul style="margin:10px 0 0;padding-left:20px;color:#405148;font-size:14px;line-height:1.7">${transportText.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}</ul>`;
  const additionalPanel = additionalDetails
    ? emailPanel(`<p style="margin:0 0 8px;color:#1d2823;font-size:15px;font-weight:700">Additional requirements</p><p style="margin:0;color:#405148;font-size:14px;line-height:1.65;white-space:pre-line">${escapeEmailHtml(additionalDetails)}</p><p style="margin:12px 0 0;color:#405148;font-size:13px;line-height:1.6"><strong>Please confirm these requirements at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed requirements.</p>`, "soft")
    : "";
  const html = emailLayout({
    eyebrow: "Pickup reminder",
    title: "Your pickup is tomorrow",
    intro: `Hi ${escapeEmailHtml(booking.first_name.trim()) || "there"}, please review the details below for ${escapeEmailHtml(pickupDate)}${escapeEmailHtml(pickupTime)}.`,
    content: `
      ${emailPanel(emailDetailsTable([
        { label: "Hire items", value: hireItems.join(", ") || "None specified" },
        { label: "Pickup address", value: "181 Nicholson St, Abbotsford VIC 3067" },
        { label: "Phone", value: "0452 316 823" },
      ]), "accent")}
      ${emailPanel(`<p style="margin:0;color:#574412;font-size:14px;line-height:1.6"><strong>Please message or call 30 minutes before arriving.</strong></p>`, "warning")}
      ${emailPanel(`<p style="margin:0;color:#405148;font-size:14px;line-height:1.6"><strong>Please note:</strong> Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.</p>`, "soft")}
      ${emailPanel(`<p style="margin:0;color:#1d2823;font-size:15px;font-weight:700">Hire items</p>${hireItemsList}`, "soft")}
      ${emailPanel(`<p style="margin:0;color:#1d2823;font-size:15px;font-weight:700">Transport and handling</p>${transportList}`, "soft")}
      ${additionalPanel}
      <p style="margin:24px 0 0;color:#718078;font-size:14px;line-height:1.65">Please bring suitable transport and valid photo ID for pickup.</p>
    `,
  });
  return { subject: `Pickup reminder for ${pickupDate} — Peppermint Audio`, text, html };
}

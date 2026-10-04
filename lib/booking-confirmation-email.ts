import { emailFooterText } from "@/lib/email-footer";
import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "@/lib/email-template";
import { escapeHtml, type PickupInstructionSource, getPickupInstructions } from "@/lib/pickup-reminders";
import { summarizeBookingLineItems, type BookingLineItem } from "@/lib/booking-line-items";

type BookingConfirmationDetails = {
  bookingReference?: string;
  firstName: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  hireLineItems: BookingLineItem[];
  pickupInstructions?: PickupInstructionSource;
};

export function buildBookingConfirmationEmail(details: BookingConfirmationDetails) {
  const hireItems = summarizeBookingLineItems(details.hireLineItems) || "None specified";
  const pickup = details.pickupTime ? `${details.pickupDate} at ${details.pickupTime}` : details.pickupDate;
  const dropoff = details.dropoffTime ? `${details.dropoffDate} at ${details.dropoffTime}` : details.dropoffDate;
  const pickupInstructions = details.pickupInstructions ? getPickupInstructions(details.pickupInstructions) : null;
  const pickupInstructionsText = pickupInstructions
    ? [
      "",
      "Same-day pickup details:",
      "Hire items:",
      "Pickup address: 181 Nicholson St, Abbotsford VIC 3067",
      "Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.",
      "",
      "Please note: Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.",
      "",
      ...(pickupInstructions.hireItems.length ? pickupInstructions.hireItems.map((item) => `- ${item}`) : ["- None specified"]),
      "",
      "Transport and handling:",
      ...pickupInstructions.transportText,
      "",
      ...(pickupInstructions.additionalDetails
        ? ["Additional requirements:", pickupInstructions.additionalDetails, "Please confirm these requirements with Peppermint Audio at pickup. Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.", ""]
        : []),
      "Please bring suitable transport and valid photo ID for pickup.",
    ].join("\n")
    : "";
  const pickupInstructionsHtml = pickupInstructions
    ? `<div style="margin-top:24px;border:1px solid #e4ddd5;border-radius:12px;background:#faf9f7;padding:20px"><p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#20211f">Same-day pickup details</p><p style="margin:7px 0;font-size:14px"><strong>Pickup address:</strong> 181 Nicholson St, Abbotsford VIC 3067</p><p style="margin:16px 0;padding:12px;background:#fff3d6;border:1px solid #e8c979"><strong>Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.</strong></p><p style="margin:16px 0;padding:12px;background:#e8eee8"><strong>Please note:</strong> Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.</p><h2 style="font-size:16px;color:#20211f">Hire items</h2><ul>${(pickupInstructions.hireItems.length ? pickupInstructions.hireItems : ["None specified"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Transport and handling</h2><ul>${pickupInstructions.transportText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${pickupInstructions.additionalDetails ? `<h2 style="font-size:16px;color:#20211f">Additional requirements</h2><p style="white-space:pre-line">${escapeHtml(pickupInstructions.additionalDetails)}</p><p><strong>Please confirm these requirements with Peppermint Audio at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.</p>` : ""}<p>Please bring suitable transport and valid photo ID for pickup.</p></div>`
    : "";
  const subject = "Your booking with Peppermint Audio has been confirmed.";
  const text = [
    `Hi ${details.firstName},`,
    "",
    "Your booking with Peppermint Audio has been confirmed.",
    "",
    ...(details.bookingReference ? [`Booking reference: ${details.bookingReference}`, ""] : []),
    `Event: ${details.eventType}`,
    `Pickup: ${pickup}`,
    `Drop-off: ${dropoff}`,
    `Hire items: ${hireItems}`,
    pickupInstructionsText,
    "",
    "Our team will be in touch if there are any final details to discuss.",
    "",
    emailFooterText,
  ].join("\n");
  const html = emailLayout({
    eyebrow: "Booking confirmed",
    title: "Your booking is confirmed",
    intro: `Thank you${details.firstName.trim() ? `, ${escapeEmailHtml(details.firstName.trim())}` : ""}. Your request has been reviewed and confirmed by our team.`,
    content: `
      ${emailPanel(emailDetailsTable([
        ...(details.bookingReference ? [{ label: "Reference", value: details.bookingReference }] : []),
        { label: "Event", value: details.eventType },
        { label: "Pickup", value: pickup },
        { label: "Drop-off", value: dropoff },
        { label: "Hire items", value: hireItems },
      ]), "accent")}
      ${pickupInstructionsHtml ? emailPanel(pickupInstructionsHtml, "soft") : ""}
      <p style="margin:24px 0 0;color:#718078;font-size:14px;line-height:1.65">Our team will be in touch if there are any final details to discuss.</p>
    `,
  });
  return { subject, text, html };
}

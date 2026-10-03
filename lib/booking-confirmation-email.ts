import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";
import { escapeHtml, type PickupInstructionSource, getPickupInstructions } from "@/lib/pickup-reminders";

type BookingConfirmationDetails = {
  firstName: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  packageInterest: string;
  addOns: string[];
  pickupInstructions?: PickupInstructionSource;
};

export function buildBookingConfirmationEmail(details: BookingConfirmationDetails) {
  const addOns = details.addOns.length ? details.addOns.join(", ") : "None selected";
  const pickup = details.pickupTime ? `${details.pickupDate} at ${details.pickupTime}` : details.pickupDate;
  const dropoff = details.dropoffTime ? `${details.dropoffDate} at ${details.dropoffTime}` : details.dropoffDate;
  const pickupInstructions = details.pickupInstructions ? getPickupInstructions(details.pickupInstructions) : null;
  const pickupInstructionsText = pickupInstructions
    ? [
      "",
      "Same-day pickup details:",
      `Package: ${pickupInstructions.packageName}`,
      "Pickup address: 181 Nicholson St, Abbotsford VIC 3067",
      "Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.",
      "",
      "Please note: Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.",
      "",
      "Equipment inclusions:",
      ...pickupInstructions.inclusions.map((inclusion) => `- ${inclusion}`),
      "",
      "Selected add-ons:",
      ...(pickupInstructions.addOns.length ? pickupInstructions.addOns.map((addOn) => `- ${addOn}`) : ["None selected"]),
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
    ? `<div style="margin-top:24px;border:1px solid #e4ddd5;border-radius:12px;background:#faf9f7;padding:20px"><p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#20211f">Same-day pickup details</p><p style="margin:7px 0;font-size:14px"><strong>Pickup address:</strong> 181 Nicholson St, Abbotsford VIC 3067</p><p style="margin:16px 0;padding:12px;background:#fff3d6;border:1px solid #e8c979"><strong>Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.</strong></p><p style="margin:16px 0;padding:12px;background:#e8eee8"><strong>Please note:</strong> Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.</p><h2 style="font-size:16px;color:#20211f">Equipment inclusions</h2><ul>${pickupInstructions.inclusions.map((inclusion) => `<li>${escapeHtml(inclusion)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Selected add-ons</h2><ul>${(pickupInstructions.addOns.length ? pickupInstructions.addOns : ["None selected"]).map((addOn) => `<li>${escapeHtml(addOn)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Transport and handling</h2><ul>${pickupInstructions.transportText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${pickupInstructions.additionalDetails ? `<h2 style="font-size:16px;color:#20211f">Additional requirements</h2><p style="white-space:pre-line">${escapeHtml(pickupInstructions.additionalDetails)}</p><p><strong>Please confirm these requirements with Peppermint Audio at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.</p>` : ""}<p>Please bring suitable transport and valid photo ID for pickup.</p></div>`
    : "";
  const subject = "Your booking with Peppermint Audio has been confirmed.";
  const text = [
    `Hi ${details.firstName},`,
    "",
    "Your booking with Peppermint Audio has been confirmed.",
    "",
    `Event: ${details.eventType}`,
    `Pickup: ${pickup}`,
    `Drop-off: ${dropoff}`,
    `Package: ${details.packageInterest}`,
    `Add-ons: ${addOns}`,
    pickupInstructionsText,
    "",
    "Our team will be in touch if there are any final details to discuss.",
    "",
    emailFooterText,
  ].join("\n");
  const html = `
    <div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f">
      <div style="margin:0 auto;max-width:600px;overflow:hidden;border:1px solid #e4ddd5;border-radius:16px;background:#fff">
        <div style="background:#1c2925;padding:28px 32px;text-align:center">
          <img src="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.peppermintaudio.com.au"}/logo-white.png" alt="Peppermint Audio" width="170" style="display:block;width:170px;height:auto;margin:0 auto" />
        </div>
        <div style="padding:34px 32px">
          <p style="margin:0 0 8px;color:#5c806f;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Booking confirmed</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#20211f">Hi ${escapeHtml(details.firstName)}, your booking is confirmed.</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#565955">Thank you for booking with Peppermint Audio. Your request has been reviewed and confirmed by our team.</p>
          <div style="border:1px solid #e4ddd5;border-radius:12px;background:#faf9f7;padding:20px">
            <p style="margin:0 0 16px;font-size:14px;font-weight:bold;color:#20211f">Booking details</p>
            <p style="margin:7px 0;font-size:14px"><strong>Event:</strong> ${escapeHtml(details.eventType)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Pickup:</strong> ${escapeHtml(pickup)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Drop-off:</strong> ${escapeHtml(dropoff)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Package:</strong> ${escapeHtml(details.packageInterest)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Add-ons:</strong> ${escapeHtml(addOns)}</p>
          </div>
          ${pickupInstructionsHtml}
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#565955">Our team will be in touch if there are any final details to discuss.</p>
        </div>
        ${emailFooterHtml}
      </div>
    </div>
  `;
  return { subject, text, html };
}

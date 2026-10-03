import { packageTiers, type PackageTier } from "@/lib/site-content";
import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";

export type PickupReminderBooking = {
  email: string;
  first_name: string;
  last_name: string;
  event_type: string;
  pickup_date: string;
  pickup_time?: string | null;
  package_interest: string;
  add_ons?: string[] | null;
  additional_details: string | null;
};

export type PickupInstructionSource = Pick<PickupReminderBooking, "package_interest" | "add_ons" | "additional_details">;

export function findPackage(packageInterest: string): PackageTier | undefined {
  const value = packageInterest.trim().toLowerCase();
  return packageTiers.find((pkg) => pkg.slug.toLowerCase() === value || pkg.name.toLowerCase() === value);
}

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
  const packageTier = findPackage(booking.package_interest);
  return {
    packageName: packageTier?.name ?? booking.package_interest,
    additionalDetails: booking.additional_details?.trim() ?? "",
    inclusions: packageTier?.inclusions ?? ["Please confirm the package inclusions with Peppermint Audio at pickup."],
    addOns: booking.add_ons?.filter(Boolean) ?? [],
    transportText: [
      "Please make sure there is adequate space in your transport when collecting the equipment.",
      "For the smaller packages, a sedan with an empty boot or folded-down rear seats should generally be suitable.",
      "The Big Celebration package includes a subwoofer and requires additional space. The same applies if a subwoofer has been selected as an add-on.",
      "Help will be provided on site to load the equipment, but the hirer is responsible for transporting and safely handling it after pickup.",
    ],
  };
}

export function buildPickupReminderEmail(booking: PickupReminderBooking) {
  const { packageName, additionalDetails, inclusions, addOns, transportText } = getPickupInstructions(booking);
  const pickupDate = formatMelbourneDate(booking.pickup_date);
  const pickupTime = booking.pickup_time ? ` at ${booking.pickup_time}` : "";
  const logoUrl = "https://www.peppermintaudio.com.au/logo-white.png";
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
    `Package: ${packageName}`,
    `Pickup address: 181 Nicholson St, Abbotsford VIC 3067`,
    "Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.",
    "",
    "Please note: Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.",
    "",
    "Equipment inclusions:",
    ...inclusions.map((inclusion) => `- ${inclusion}`),
    "",
    "Selected add-ons:",
    ...(addOns.length ? addOns.map((addOn) => `- ${addOn}`) : ["None selected"]),
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
  const htmlAdditional = additionalDetails
    ? `<h2 style="font-size:16px;color:#20211f">Additional requirements</h2><p style="white-space:pre-line">${escapeHtml(additionalDetails)}</p><p><strong>Please confirm these requirements with Peppermint Audio at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.</p>`
    : "";
  const html = `<div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f"><div style="margin:0 auto;max-width:600px;border:1px solid #e4ddd5;border-radius:16px;background:#fff;overflow:hidden"><div style="background:#1c2925;padding:26px 32px;text-align:center"><img src="${logoUrl}" alt="Peppermint Audio" width="190" style="display:block;width:190px;height:auto;margin:0 auto" /></div><div style="padding:32px"><p style="margin:0 0 8px;color:#5c806f;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Pickup reminder</p><h1 style="margin:0 0 12px;font-size:26px">Hi ${escapeHtml(booking.first_name)}. Your pickup is tomorrow.</h1><p style="margin:0 0 24px">Please review the details below for <strong>${escapeHtml(pickupDate)}${escapeHtml(pickupTime)}</strong>.</p><table role="presentation" style="width:100%;border-collapse:collapse;background:#faf9f7"><tr><td style="padding:10px 12px;color:#5c806f;font-weight:bold">Package</td><td style="padding:10px 12px">${escapeHtml(packageName)}</td></tr><tr><td style="padding:10px 12px;color:#5c806f;font-weight:bold">Pickup address</td><td style="padding:10px 12px"><strong>181 Nicholson St, Abbotsford VIC 3067</strong></td></tr><tr><td style="padding:10px 12px;color:#5c806f;font-weight:bold">Phone</td><td style="padding:10px 12px"><strong>0452 316 823</strong></td></tr></table><p style="margin:20px 0;padding:16px;background:#fff3d6;border:1px solid #e8c979"><strong>Please message or call 30 minutes before arriving.</strong></p><p style="padding:16px;background:#e8eee8"><strong>Please note:</strong> Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.</p><h2 style="font-size:16px;color:#20211f">Equipment inclusions</h2><ul>${inclusions.map((inclusion) => `<li>${escapeHtml(inclusion)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Selected add-ons</h2><ul>${(addOns.length ? addOns : ["None selected"]).map((addOn) => `<li>${escapeHtml(addOn)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Transport and handling</h2><ul>${transportText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${htmlAdditional}<p>Please bring suitable transport and valid photo ID for pickup.</p></div>${emailFooterHtml}</div></div>`;
  return { subject: `Pickup reminder for ${pickupDate} — Peppermint Audio`, text, html };
}

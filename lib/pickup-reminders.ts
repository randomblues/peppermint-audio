import { packageTiers, type PackageTier } from "@/lib/site-content";

export type PickupReminderBooking = {
  email: string;
  first_name: string;
  last_name: string;
  event_type: string;
  pickup_date: string;
  package_interest: string;
  additional_details: string | null;
};

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

export function buildPickupReminderEmail(booking: PickupReminderBooking) {
  const packageTier = findPackage(booking.package_interest);
  const packageName = packageTier?.name ?? booking.package_interest;
  const pickupDate = formatMelbourneDate(booking.pickup_date);
  const additionalDetails = booking.additional_details?.trim();
  const additionalText = additionalDetails
    ? [
      "Additional requirements:",
      additionalDetails,
      "Please confirm these requirements with Peppermint Audio at pickup. Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.",
    ]
    : "";
  const inclusions = packageTier?.inclusions ?? ["Please confirm the package inclusions with Peppermint Audio at pickup."];
  const transportText = [
    "Please make sure there is adequate space in your transport when collecting the equipment.",
    "For the Speech & Presentation and Standard packages, a sedan with an empty boot or folded-down rear seats should generally be suitable.",
    "The Big Events package includes a subwoofer and requires additional space. The same applies if a subwoofer has been selected as an add-on to the Speech & Presentation or Standard package.",
    "Help will be provided on site to load the equipment, but the hirer is responsible for transporting and safely handling it after pickup.",
  ];
  const text = [
    `Hi ${booking.first_name},`,
    "",
    `This is a reminder that your Peppermint Audio equipment pickup is tomorrow, ${pickupDate}.`,
    "",
    `Customer: ${booking.first_name} ${booking.last_name}`,
    `Event: ${booking.event_type}`,
    `Package: ${packageName}`,
    `Pickup address: 181 Nicholson St, Abbotsford VIC 3067`,
    "Please message or call Peppermint Audio on 0452 316 823 30 minutes before arriving.",
    "",
    "Please note: Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.",
    "",
    "Equipment inclusions:",
    ...inclusions.map((inclusion) => `- ${inclusion}`),
    "",
    "Transport and handling:",
    ...transportText,
    "",
    additionalText,
    "",
    "Please bring suitable transport and valid photo ID for pickup.",
    "",
    "Kind regards,",
    "Peppermint Audio",
    "0452 316 823",
  ].filter(Boolean).join("\n");
  const htmlAdditional = additionalDetails
    ? `<h2 style="font-size:16px;color:#20211f">Additional requirements</h2><p style="white-space:pre-line">${escapeHtml(additionalDetails)}</p><p><strong>Please confirm these requirements with Peppermint Audio at pickup.</strong> Peppermint Audio is not responsible for anything extra required beyond what is provided in the package and discussed additional requirements.</p>`
    : "";
  const html = `<div style="margin:0;background:#f4f1ed;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#20211f"><div style="margin:0 auto;max-width:600px;border:1px solid #e4ddd5;border-radius:16px;background:#fff;overflow:hidden"><div style="background:#1c2925;padding:28px 32px;text-align:center;color:#fff"><strong style="font-size:22px">Peppermint Audio</strong></div><div style="padding:32px"><p style="margin:0 0 8px;color:#5c806f;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Pickup reminder</p><h1 style="margin:0 0 16px;font-size:26px">Your pickup is tomorrow</h1><p>Hi ${escapeHtml(booking.first_name)}, please review these pickup details for <strong>${escapeHtml(pickupDate)}</strong>.</p><table role="presentation" style="width:100%;border-collapse:collapse;background:#faf9f7;padding:12px"><tr><td>Customer</td><td><strong>${escapeHtml(`${booking.first_name} ${booking.last_name}`)}</strong></td></tr><tr><td>Event</td><td>${escapeHtml(booking.event_type)}</td></tr><tr><td>Package</td><td>${escapeHtml(packageName)}</td></tr><tr><td>Pickup address</td><td><strong>181 Nicholson St, Abbotsford VIC 3067</strong></td></tr><tr><td>Phone</td><td><strong>0452 316 823</strong></td></tr></table><p style="margin:20px 0;padding:16px;background:#fff3d6;border:1px solid #e8c979"><strong>Please message or call 30 minutes before arriving.</strong></p><p style="padding:16px;background:#e8eee8"><strong>Please note:</strong> Peppermint Audio is a small business operating from a private residence. Please respect the property and call upon arrival.</p><h2 style="font-size:16px;color:#20211f">Equipment inclusions</h2><ul>${inclusions.map((inclusion) => `<li>${escapeHtml(inclusion)}</li>`).join("")}</ul><h2 style="font-size:16px;color:#20211f">Transport and handling</h2><ul>${transportText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${htmlAdditional}<p>Please bring suitable transport and valid photo ID for pickup.</p></div><div style="background:#1c2925;padding:24px 32px;text-align:center;color:#fff"><img src="https://www.peppermintaudio.com.au/logo-white.png" alt="Peppermint Audio" width="170" style="display:block;width:170px;height:auto;margin:0 auto 12px" /><p style="margin:0">0452 316 823</p></div></div></div>`;
  return { subject: `Pickup reminder for ${pickupDate} — Peppermint Audio`, text, html };
}

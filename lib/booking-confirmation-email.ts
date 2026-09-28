import { emailFooterHtml, emailFooterText } from "@/lib/email-footer";

type BookingConfirmationDetails = {
  firstName: string;
  eventType: string;
  pickupDate: string;
  dropoffDate: string;
  packageInterest: string;
  addOns: string[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function buildBookingConfirmationEmail(details: BookingConfirmationDetails) {
  const addOns = details.addOns.length ? details.addOns.join(", ") : "None selected";
  const subject = `Your Peppermint Audio booking is confirmed — ${details.pickupDate}`;
  const text = [
    `Hi ${details.firstName},`,
    "",
    "Your Peppermint Audio booking has been confirmed.",
    "",
    `Event: ${details.eventType}`,
    `Pickup date: ${details.pickupDate}`,
    `Drop-off date: ${details.dropoffDate}`,
    `Package: ${details.packageInterest}`,
    `Add-ons: ${addOns}`,
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
            <p style="margin:7px 0;font-size:14px"><strong>Pickup:</strong> ${escapeHtml(details.pickupDate)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Drop-off:</strong> ${escapeHtml(details.dropoffDate)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Package:</strong> ${escapeHtml(details.packageInterest)}</p>
            <p style="margin:7px 0;font-size:14px"><strong>Add-ons:</strong> ${escapeHtml(addOns)}</p>
          </div>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#565955">Our team will be in touch if there are any final details to discuss.</p>
        </div>
        ${emailFooterHtml}
      </div>
    </div>
  `;
  return { subject, text, html };
}

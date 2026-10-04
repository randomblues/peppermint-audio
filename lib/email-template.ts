import { emailFooterHtml } from "@/lib/email-footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.peppermintaudio.com.au";
const logoUrl = `${siteUrl}/logo-white.png`;

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function emailDetailsTable(rows: Array<{ label: string; value: string }>) {
  return `
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;font-size:14px;line-height:1.5">
      ${rows.map((row, index) => `
        <tr>
          <td style="width:36%;padding:12px 10px 12px 16px;border-bottom:${index === rows.length - 1 ? "0" : "1px solid #e7ece8"};color:#668074;font-weight:700;vertical-align:top">${escapeEmailHtml(row.label)}</td>
          <td style="padding:12px 16px 12px 10px;border-bottom:${index === rows.length - 1 ? "0" : "1px solid #e7ece8"};color:#1d2823;font-weight:600;text-align:left;vertical-align:top;overflow-wrap:anywhere">${escapeEmailHtml(row.value)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

export function emailPanel(content: string, tone: "soft" | "accent" | "warning" = "soft") {
  const styles = {
    soft: "border:1px solid #e1e9e3;background:#f7faf8",
    accent: "border:1px solid #b9ddc8;background:#edf8f1",
    warning: "border:1px solid #ead59a;background:#fff9e8",
  };
  return `<div style="${styles[tone]};border-radius:16px;padding:20px 22px;margin:20px 0">${content}</div>`;
}

export function emailLayout({
  eyebrow,
  title,
  intro,
  content,
}: {
  eyebrow: string;
  title?: string;
  intro?: string;
  content: string;
}) {
  return `
    <div style="margin:0;background:#eef2ef;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1d2823">
      <div style="margin:0 auto;max-width:640px;overflow:hidden;border:1px solid #dbe5de;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(28,41,37,.08)">
        <div style="background:#16251f;padding:34px 36px 30px;text-align:center">
          <img src="${logoUrl}" alt="Peppermint Audio" width="190" style="display:block;width:190px;height:auto;margin:0 auto 30px" />
          <p style="margin:0;color:#8bd2aa;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase">${escapeEmailHtml(eyebrow)}</p>
          ${title ? `<h1 style="margin:10px 0 0;color:#fff;font-size:30px;line-height:1.18;letter-spacing:-.4px">${escapeEmailHtml(title)}</h1>` : ""}
        </div>
        <div style="padding:34px 36px 38px">
          ${intro ? `<p style="margin:0 0 24px;color:#53645b;font-size:16px;line-height:1.65">${intro}</p>` : ""}
          ${content}
        </div>
        ${emailFooterHtml}
      </div>
    </div>
  `;
}

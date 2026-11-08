import { describe, expect, it } from "vitest";

import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "./email-template";

describe("email template", () => {
  it("escapes dynamic values and preserves the shared brand shell", () => {
    const html = emailLayout({
      eyebrow: "Invoice",
      title: "<Review>",
      intro: "Hello",
      content: emailPanel(emailDetailsTable([{ label: "Customer", value: "<Alex> & Co" }]), "accent"),
    });

    expect(html).toContain("Peppermint Audio");
    expect(html).toContain("&lt;Review&gt;");
    expect(html).toContain("&lt;Alex&gt; &amp; Co");
    expect(html).toContain("background:#16251f");
  });

  it("escapes standalone email values", () => {
    expect(escapeEmailHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("supports a red danger panel for urgent alerts", () => {
    expect(emailPanel("<p>Urgent</p>", "danger")).toContain("border:1px solid #e6a8a8;background:#fff0f0");
  });

  it("can omit the large header title for invoice emails", () => {
    const html = emailLayout({
      eyebrow: "Tax invoice",
      content: "<p>Attached PDF</p>",
    });

    expect(html).toContain("Tax invoice");
    expect(html).not.toContain("<h1");
  });
});

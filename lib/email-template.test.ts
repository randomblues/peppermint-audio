import { describe, expect, it } from "vitest";

import { emailDetailsTable, emailLayout, emailPanel, escapeEmailHtml } from "./email-template";

describe("email template", () => {
  it("provides one coherent notification preview even when block-edge whitespace is stripped", () => {
    const html = emailLayout({
      eyebrow: "New booking request",
      title: "A new request needs review",
      intro: "A customer has submitted a booking request with photo ID. Review availability before confirming it.",
      content: emailDetailsTable([{ label: "Booking Reference:", value: "PA-EXAMPLE" }]),
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent?.trim() ?? "");
    const preview = parts.join("").replace(/[\u00a0\u200c]/g, " ").replace(/\s+/g, " ").trim();

    expect(preview.startsWith(
      "New booking request A new request needs review A customer has submitted a booking request with photo ID. Review availability before confirming it.",
    )).toBe(true);
    const preheader = document.body.firstElementChild;
    expect(preheader?.getAttribute("style")).toContain("display:none");
    expect(preheader?.getAttribute("aria-hidden")).toBe("true");
    expect(preheader?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(preheader?.querySelector("span")?.textContent?.length).toBeGreaterThanOrEqual(300);
  });

  it("keeps booking preview text separated when inter-tag whitespace is removed", () => {
    const html = emailLayout({
      eyebrow: "New booking request",
      title: "A new request needs review",
      intro: "A customer has submitted a booking request.",
      content: emailPanel(emailDetailsTable([
        { label: "Booking Reference:", value: "PA-EXAMPLE" },
        { label: "Customer", value: "Alex & Co" },
      ])),
    });
    const document = new DOMParser().parseFromString(html.replace(/>\s+</g, "><"), "text/html");
    document.body.firstElementChild?.remove();
    const preview = document.body.textContent?.replace(/\s+/g, " ").trim();

    expect(preview).toContain(
      "New booking request A new request needs review A customer has submitted a booking request. Booking Reference: PA-EXAMPLE Customer Alex & Co",
    );
  });

  it("separates the eyebrow from details when the title and intro are omitted", () => {
    const html = emailLayout({
      eyebrow: "Invoice",
      content: emailDetailsTable([{ label: "Customer", value: "<Alex>" }]),
    });
    const document = new DOMParser().parseFromString(html.replace(/>\s+</g, "><"), "text/html");

    expect(document.body.textContent?.replace(/\s+/g, " ")).toContain("Invoice Customer <Alex> ");
  });

  it("preserves separators in fallback body previews and table cells when ordinary boundary spaces are stripped", () => {
    const html = emailLayout({
      eyebrow: "Booking received",
      title: "Thanks for your request",
      intro: "We have received your booking request.",
      content: emailDetailsTable([
        { label: "Booking Reference:", value: "PA-EXAMPLE" },
        { label: "Customer", value: "Alex & Co" },
      ]),
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    document.body.firstElementChild?.remove();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) {
      parts.push((walker.currentNode.textContent ?? "").replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ""));
    }
    expect(parts.join("").replace(/\s+/g, " ")).toContain(
      "Booking received Thanks for your request We have received your booking request. Booking Reference: PA-EXAMPLE Customer Alex & Co",
    );
  });

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

  it("can omit the eyebrow without an empty header paragraph or broken preview", () => {
    const html = emailLayout({
      title: "Your pickup details",
      intro: "Hi Alex, please review your pickup details.",
      content: "<p>Pickup address</p>",
    });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("h1")?.textContent?.trim()).toBe("Your pickup details");
    expect(document.querySelector("h1")?.parentElement?.querySelector("p")).toBeNull();
    expect(document.body.firstElementChild?.firstChild?.textContent).toBe(
      "Your pickup details Hi Alex, please review your pickup details.",
    );
    expect(html).not.toContain("undefined");
  });
});

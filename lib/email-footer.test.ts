import { describe, expect, it } from "vitest";

import { emailFooterHtml, emailFooterText } from "./email-footer";

describe("email footer", () => {
  it("provides the standard contact details for text and HTML emails", () => {
    expect(emailFooterText).toContain("Kind regards,\nPeppermint Audio");
    expect(emailFooterText).toContain("Melbourne audio equipment hire · Abbotsford 3067");
    expect(emailFooterText).toContain("contactus@peppermintaudio.com.au · 0452 316 823");
    expect(emailFooterHtml).toContain("mailto:contactus@peppermintaudio.com.au");
    expect(emailFooterHtml).toContain("tel:+61452316823");
    expect(emailFooterHtml).toContain("background:#16251f");
    expect(emailFooterHtml).toContain("Pickup and return in Abbotsford 3067");
  });
});

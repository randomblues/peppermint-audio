import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { PackageCard } from "./package-card";
import { Section } from "./section";
import { WhatsAppButton } from "./whatsapp-button";
import * as googleAds from "@/lib/google-ads";
import { packageTiers } from "@/lib/site-content";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("Navbar", () => {
  it("provides desktop navigation and a labelled mobile menu trigger", () => {
    render(<Navbar />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Peppermint Audio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Packages" })).toHaveAttribute("href", "/packages");
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    const bookingLinks = screen.getAllByText("Book now").map((element) => element.closest("a"));
    expect(bookingLinks).toHaveLength(1);
    expect(bookingLinks.every((link) => link?.getAttribute("href") === "/booking")).toBe(true);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("shows pickup and contact details with an enquiry link", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Pickup: Abbotsford 3067")).toBeInTheDocument();
    expect(within(footer).getByText("Servicing Melbourne")).toBeInTheDocument();
    expect(within(footer).getByText("Email: contactus@peppermintaudio.com.au")).toBeInTheDocument();
    expect(within(footer).getByText("Send an enquiry").closest("a")).toHaveAttribute("href", "/contact");
  });
});

describe("PackageCard", () => {
  it("renders package data, inclusions, add-ons, and booking links", () => {
    const pkg = packageTiers[1];
    render(<PackageCard pkg={pkg} />);

    expect(screen.getByText(pkg.name)).toBeInTheDocument();
    expect(screen.getByText(`$${pkg.price}`)).toBeInTheDocument();
    expect(screen.getByText(`Ideal for ${pkg.capacity}`)).toBeInTheDocument();
    expect(screen.getByText(`- ${pkg.inclusions[0]}`)).toBeInTheDocument();
    expect(screen.getByText("Wireless Microphone Upgrade")).toBeInTheDocument();
    expect(screen.getAllByText("+$20").length).toBeGreaterThan(0);
    expect(screen.getByText("Enquire about this package").closest("a")).toHaveAttribute(
      "href",
      `/contact?package=${pkg.slug}`,
    );
    expect(screen.getByText("Book this package").closest("a")).toHaveAttribute(
      "href",
      `/booking?package=${pkg.slug}`,
    );
    expect(screen.getByRole("img", { name: pkg.name })).toHaveAttribute("src", expect.stringContaining("pexels"));
  });

  it("uses compact content and details link when requested", () => {
    const pkg = packageTiers[0];
    render(<PackageCard pkg={pkg} compact />);

    expect(screen.getByText(pkg.summary)).toBeInTheDocument();
    expect(screen.queryByText(`- ${pkg.inclusions[0]}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Optional add-ons")).not.toBeInTheDocument();
    expect(screen.getByText("View package details").closest("a")).toHaveAttribute(
      "href",
      `/packages?package=${pkg.slug}`,
    );
  });
});

describe("WhatsAppButton", () => {
  beforeEach(() => usePathname.mockReset());

  it("renders an accessible WhatsApp link on public pages", () => {
    usePathname.mockReturnValue("/contact");
    render(<WhatsAppButton />);

    const link = screen.getByRole("link", { name: "Chat with Peppermint Audio on WhatsApp" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/61452316823"));
    expect(link).toHaveTextContent("Chat on WhatsApp");
  });

  it("tracks WhatsApp clicks", () => {
    const trackClick = vi.spyOn(googleAds, "trackGoogleAdsWhatsAppClick");
    usePathname.mockReturnValue("/contact");
    render(<WhatsAppButton />);

    fireEvent.click(screen.getByRole("link", { name: "Chat with Peppermint Audio on WhatsApp" }));

    expect(trackClick).toHaveBeenCalledTimes(1);
  });

  it("is hidden from admin pages", () => {
    usePathname.mockReturnValue("/admin");
    render(<WhatsAppButton />);

    expect(screen.queryByRole("link", { name: "Chat with Peppermint Audio on WhatsApp" })).not.toBeInTheDocument();
  });
});

describe("Section", () => {
  it("renders optional headings and preserves child content", () => {
    render(
      <Section eyebrow="Packages" title="Choose a package" description="Ready-to-use systems.">
        <button type="button">Continue</button>
      </Section>,
    );

    expect(screen.getByText("Packages")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose a package" })).toBeInTheDocument();
    expect(screen.getByText("Ready-to-use systems.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("omits optional content when it is not supplied", () => {
    render(
      <Section title="A title">
        <p>Body</p>
      </Section>,
    );

    expect(screen.getByRole("heading", { name: "A title" })).toBeInTheDocument();
    expect(screen.queryByText("Packages")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready-to-use systems.")).not.toBeInTheDocument();
  });
});

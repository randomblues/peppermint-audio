import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { PackageCard } from "./package-card";
import { PackageCarousel } from "./package-carousel";
import { EquipmentCard } from "./equipment-card";
import { CustomerReviews } from "./customer-reviews";
import { PhoneCallButton } from "./phone-call-button";
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
    expect(screen.getByRole("button", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.queryByText("Book now")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open cart/ })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  describe("EquipmentCard", () => {
    it("defaults to the pair option and carries a changed selection into the enquiry", () => {
      const item = {
        slug: "test-speaker",
        name: "Test Speaker",
        category: "Speakers",
        description: "A test speaker.",
        image: "https://images.unsplash.com/test",
        options: [
          { label: "Pair (2 speakers)", price: 95 },
          { label: "Single speaker", price: 55 },
        ],
        details: ["Portable"],
      };

      render(<EquipmentCard item={item} />);

      expect(screen.getByRole("button", { name: "Pair (2 speakers) $95" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      fireEvent.click(screen.getByRole("button", { name: "Single speaker $55" }));

      expect(screen.getByRole("button", { name: "Single speaker $55" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText("View equipment details").closest("a")).toHaveAttribute(
        "href",
        "/equipment/test-speaker",
      );
    });

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
  it("renders package data and cart actions", () => {
    const pkg = packageTiers[0];
    render(<PackageCard pkg={pkg} />);

    expect(screen.getByText(pkg.name)).toBeInTheDocument();
    expect(screen.getByText(`$${pkg.price}`)).toBeInTheDocument();
    expect(screen.getByText(`Ideal for ${pkg.capacity}`)).toBeInTheDocument();
    expect(screen.getByText(`- ${pkg.inclusions[0]}`)).toBeInTheDocument();
    expect(screen.getByText("View package details").closest("a")).toHaveAttribute(
      "href",
      `/packages?package=${pkg.slug}`,
    );
    expect(screen.getByRole("button", { name: "Add package to cart" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: pkg.name })).toHaveAttribute(
      "src",
      expect.stringContaining("speech-presentation-package.png"),
    );
  });

  describe("PackageCarousel", () => {
    it("renders every package in a horizontally scrollable region", () => {
      render(<PackageCarousel />);

      expect(screen.getByRole("button", { name: "Previous package" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next package" })).toBeInTheDocument();
      expect(screen.getByLabelText("Choose a package")).toBeInTheDocument();
      for (const pkg of packageTiers) {
        expect(screen.getByText(pkg.name)).toBeInTheDocument();
      }
    });
  });

  it("uses compact content and details link when requested", () => {
    const pkg = packageTiers[0];
    render(<PackageCard pkg={pkg} compact />);

    expect(screen.getByText(pkg.summary)).toBeInTheDocument();
    expect(screen.getByText(`- ${pkg.inclusions[0]}`)).toBeInTheDocument();
    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(screen.queryByText("Optional add-ons")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add package to cart" })).not.toBeInTheDocument();
    expect(screen.getByText("View package details").closest("a")).toHaveAttribute(
      "href",
      `/packages?package=${pkg.slug}`,
    );
  });
});

describe("CustomerReviews", () => {
  it("shows the supplied customer reviews with five-star ratings", () => {
    render(<CustomerReviews />);

    expect(screen.getByRole("region", { name: "Customer reviews" })).toBeInTheDocument();
    expect(screen.getByText("Stan Nicholson")).toBeInTheDocument();
    expect(screen.getByText(/sound system was a great price/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("5 out of 5 stars")).toHaveLength(10);
  });
});

describe("PhoneCallButton", () => {
  it("tracks phone clicks and keeps the tap-to-call link", () => {
    const trackClick = vi.spyOn(googleAds, "trackGoogleAdsPhoneClick");
    render(<PhoneCallButton phone="0452 316 823" />);

    const link = screen.getByRole("button", { name: "Call 0452 316 823" });
    expect(link).toHaveAttribute("href", "tel:0452316823");
    fireEvent.click(link);

    expect(trackClick).toHaveBeenCalledTimes(1);
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

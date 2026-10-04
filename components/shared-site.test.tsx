import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { PackageCard } from "./package-card";
import { PackageCarousel } from "./package-carousel";
import { EquipmentCard } from "./equipment-card";
import { CustomerReviews } from "./customer-reviews";
import { PhoneCallButton } from "./phone-call-button";
import { MobileContactBar } from "./mobile-contact-bar";
import { Section } from "./section";
import { WhatsAppButton } from "./whatsapp-button";
import * as googleAds from "@/lib/google-ads";
import { business, packageTiers } from "@/lib/site-content";

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
        expect(screen.getAllByText(pkg.name).length).toBeGreaterThanOrEqual(1);
      }
      expect(screen.queryByTestId("package-carousel-left-fade")).not.toBeInTheDocument();
    });

    it("advances the selected package when the next control is clicked", () => {
      render(<PackageCarousel />);

      fireEvent.click(screen.getByRole("button", { name: "Next package" }));

      expect(
        screen.getByRole("button", { name: `Show ${packageTiers[1].name}` }),
      ).toHaveAttribute("aria-current", "true");
    });

    it("keeps advancing when the next control is clicked repeatedly", () => {
      render(<PackageCarousel />);

      const nextButton = screen.getByRole("button", { name: "Next package" });
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      expect(
        screen.getByRole("button", { name: `Show ${packageTiers[2].name}` }),
      ).toHaveAttribute("aria-current", "true");
    });
  });

  it("uses compact content and details link when requested", () => {
    const pkg = packageTiers[0];
    render(<PackageCard pkg={pkg} compact />);

    expect(screen.getByText(pkg.summary)).toHaveClass("text-muted-foreground");
    expect(screen.getByText(pkg.summary).parentElement).toHaveClass("items-center");
    expect(screen.getByText(`- ${pkg.inclusions[0]}`)).toBeInTheDocument();
    expect(screen.getByText("In the box")).toBeInTheDocument();
    const moreInclusionsButton = screen.getByRole("button", { name: "+ 1 more included" });
    expect(screen.queryByText(`- ${pkg.inclusions[3]}`)).not.toBeInTheDocument();
    fireEvent.click(moreInclusionsButton);
    expect(screen.getByText(`- ${pkg.inclusions[3]}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByText("Optional add-ons")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add package to cart" })).not.toBeInTheDocument();
  });

  it("gives the boom package artwork extra space around the subwoofer", () => {
    const pkg = packageTiers.find((packageTier) => packageTier.slug === "budget-with-a-boom");
    if (!pkg) throw new Error("Budget With A Boom package is missing");

    render(<PackageCard pkg={pkg} compact />);

    expect(screen.getByRole("img", { name: pkg.name })).toHaveClass("p-2");
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

  describe("MobileContactBar", () => {
    beforeEach(() => usePathname.mockReset());

    it("opens a unified availability contact sheet on public pages", () => {
      usePathname.mockReturnValue("/packages");
      render(<MobileContactBar />);

      expect(screen.getByRole("button", { name: "Check availability" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

      const sheet = screen.getByRole("dialog");
      expect(within(sheet).getByText("Let's check your date")).toBeInTheDocument();
      expect(within(sheet).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
        "href",
        expect.stringContaining("wa.me/61452316823"),
      );
      expect(within(sheet).getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:0452316823");
      expect(within(sheet).getByRole("link", { name: /Email/ })).toHaveAttribute(
        "href",
        `mailto:${business.email}`,
      );
    });

    it("is hidden from admin pages", () => {
      usePathname.mockReturnValue("/admin");
      render(<MobileContactBar />);

      expect(screen.queryByRole("button", { name: "Check availability" })).not.toBeInTheDocument();
    });
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

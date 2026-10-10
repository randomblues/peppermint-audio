import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { PackageCard } from "./package-card";
import { PackageCarousel } from "./package-carousel";
import { EquipmentCard } from "./equipment-card";
import { CartProvider } from "./cart-provider";
import { CustomerReviews } from "./customer-reviews";
import { PhoneCallButton } from "./phone-call-button";
import { MobileContactBar } from "./mobile-contact-bar";
import { Section } from "./section";
import { WhatsAppButton } from "./whatsapp-button";
import * as googleAds from "@/lib/google-ads";
import { lineItemsFromCart } from "@/lib/booking-line-items";
import { business, packageTiers } from "@/lib/site-content";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("Navbar", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/");
  });

  it("is hidden from admin pages", () => {
    usePathname.mockReturnValue("/admin");
    render(<Navbar />);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("provides desktop navigation and a labelled mobile menu trigger", () => {
    render(<Navbar />);

    expect(screen.getByRole("banner")).toHaveClass("bg-background");
    expect(screen.getByRole("banner")).not.toHaveClass("bg-background/80");
    expect(screen.getByRole("link", { name: "Peppermint Audio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.queryByText("Book now")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open cart/ })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("uses the trimmed logo aligned with the full-width subtitle in the mobile menu", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = screen.getByRole("dialog", { name: "Peppermint Audio" });
    const logo = within(dialog).getByRole("img", { name: "Peppermint Audio" });
    expect(logo).toHaveAttribute("src", expect.stringContaining("logo-white-trimmed.png"));
    expect(logo).toHaveAttribute("width", "472");
    expect(logo).toHaveAttribute("height", "46");
    expect(logo.parentElement).toHaveClass("items-center", "min-h-7");
    const subtitle = within(dialog).getByText("Audio system hire in Melbourne");
    expect(subtitle.parentElement).toHaveAttribute("data-slot", "sheet-header");
    expect(screen.getByRole("banner", { hidden: true }).querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-white.png"),
    );
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

      render(
        <CartProvider>
          <EquipmentCard item={item} />
        </CartProvider>,
      );

      expect(screen.getByRole("button", { name: "Pair (2 speakers) $95 / night" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      fireEvent.click(screen.getByRole("button", { name: "Single speaker $55 / night" }));

      expect(screen.getByRole("button", { name: "Single speaker $55 / night" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add to cart" })).toHaveClass("rounded-xl");
      expect(screen.getByRole("button", { name: "View details" })).toHaveAttribute(
        "href",
        "/equipment/test-speaker",
      );
      expect(screen.getByRole("button", { name: "View details" })).toHaveClass("rounded-xl");
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

      expect(JSON.parse(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toEqual([
        {
          id: "equipment:test-speaker:Single speaker",
          name: "Test Speaker",
          kind: "equipment",
          option: "Single speaker",
          price: 55,
          quantity: 1,
        },
      ]);
    });

  });
});

describe("Footer", () => {
  it("shows pickup and contact details without an enquiry button", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("pb-[calc(5rem+env(safe-area-inset-bottom))]", "md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]");
    expect(footer).not.toHaveClass("md:pb-0");
    expect(within(footer).getByText("Pickup")).toBeInTheDocument();
    expect(within(footer).getByText("Abbotsford 3067")).toBeInTheDocument();
    expect(within(footer).getByText("Servicing")).toBeInTheDocument();
    expect(within(footer).getByText("Melbourne")).toBeInTheDocument();
    expect(within(footer).getByText("Email: contactus@peppermintaudio.com.au")).toBeInTheDocument();
    expect(within(footer).queryByText("Send an enquiry")).not.toBeInTheDocument();
    expect(within(footer).queryByRole("separator")).not.toBeInTheDocument();
  });
});

describe("PackageCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
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
      const controls = screen.getByRole("group", { name: "Package navigation" });
      expect(controls).toHaveClass("flex", "justify-center", "mb-6");
      expect(screen.getByRole("button", { name: "Previous package" }).parentElement).toBe(controls);
      expect(screen.getByRole("button", { name: "Next package" })).toHaveClass("rounded-full", "size-11");
      expect(screen.getByRole("button", { name: "Next package" })).not.toHaveClass("absolute");
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
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toHaveClass("h-11", "w-full", "rounded-xl");
    expect(screen.getByRole("button", { name: "View package details" })).toHaveClass(
      "w-full",
      "rounded-xl",
      "text-muted-foreground",
    );
  });

  it("shows the upsell modal immediately after adding a package to the cart", () => {
    const pkg = packageTiers[0];

    render(
      <CartProvider>
        <PackageCard pkg={pkg} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(
      screen.getByRole("dialog", {
        name: `Recommended add-ons for ${pkg.name}`,
      }),
    ).toBeInTheDocument();
    const pricingDialog = screen.getByRole("dialog", { name: `Recommended add-ons for ${pkg.name}` });
    expect(pricingDialog).toHaveClass("max-h-[calc(100dvh-2rem)]", "overflow-y-auto");
    expect(within(pricingDialog).getByRole("button", { name: "Add this to my cart" }).parentElement).toHaveClass("grid-cols-1");
    expect(screen.getByRole("button", { name: "Continue to checkout" })).toHaveAttribute("href", "/cart");
    expect(screen.getByText("Party Light PAR Can")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toEqual(
      expect.arrayContaining([
        {
          id: `package:${pkg.slug}`,
          name: pkg.name,
          kind: "package",
          price: pkg.price,
          quantity: 1,
        },
      ]),
    );
  });

  it("suggests wireless mics and party lights only for packages where those add-ons apply", () => {
    const pkg = packageTiers.find((packageTier) => packageTier.slug === "standard-party-events");
    if (!pkg) throw new Error("Standard Party & Events package is missing");

    render(
      <CartProvider>
        <PackageCard pkg={pkg} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(screen.getByText("Wireless Microphone")).toBeInTheDocument();
    expect(screen.getByText("CR Lite MagikBar Hub Party Bar")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add this to my cart" })).toHaveLength(2);
  });

  it("adds recommended add-ons from the upsell modal as individual equipment cart items", () => {
    const pkg = packageTiers.find((packageTier) => packageTier.slug === "standard-party-events");
    if (!pkg) throw new Error("Standard Party & Events package is missing");

    render(
      <CartProvider>
        <PackageCard pkg={pkg} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add this to my cart" })[0]);

    expect(screen.getByRole("button", { name: "Added to cart" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toEqual(
      expect.arrayContaining([
        {
          id: "package:standard-party-events",
          name: "Standard Party & Events Package",
          kind: "package",
          price: 160,
          quantity: 1,
        },
        {
          id: "addon:wireless-microphones",
          name: "Wireless Microphone",
          kind: "equipment",
          option: "Single item",
          price: 20,
          quantity: 1,
        },
      ]),
    );
    expect(lineItemsFromCart(localStorage.getItem("peppermint-audio-cart") ?? "[]")).toHaveLength(2);
  });

  it("links each recommended add-on to its item details page", () => {
    const standardPackage = packageTiers.find((packageTier) => packageTier.slug === "standard-party-events");
    if (!standardPackage) throw new Error("Standard Party & Events package is missing");

    const speechPackage = packageTiers.find((packageTier) => packageTier.slug === "speech-presentation-wireless");
    if (!speechPackage) throw new Error("Speech & Presentation package is missing");

    const { unmount } = render(
      <CartProvider>
        <PackageCard pkg={standardPackage} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    const standardDetailLinks = screen.getAllByRole("button", { name: "View details" });
    expect(standardDetailLinks[0]).toHaveAttribute("href", "/equipment/k60-wireless");
    expect(standardDetailLinks[1]).toHaveAttribute("href", "/equipment/hire-party-lights-bar");

    unmount();

    render(
      <CartProvider>
        <PackageCard pkg={speechPackage} />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.getByRole("button", { name: "View details" })).toHaveAttribute(
      "href",
      "/equipment/hire-party-light-par-can",
    );
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

    it("emphasises the mobile prompt while keeping the desktop treatment", () => {
      usePathname.mockReturnValue("/cart");
      render(<MobileContactBar />);

      const availabilityButton = screen.getByRole("button", { name: "Check availability" });
      expect(availabilityButton).toHaveClass(
        "min-h-16",
        "md:min-h-14",
        "bg-background/95",
        "text-foreground",
        "border-primary/65",
        "md:border-primary/45",
      );
      expect(availabilityButton.closest(".fixed")).toHaveClass("bottom-[max(0.5rem,env(safe-area-inset-bottom))]");
      expect(availabilityButton.closest(".fixed")).not.toHaveClass("pb-[env(safe-area-inset-bottom)]");
      expect(within(availabilityButton).getByText("Check availability")).toHaveClass("text-base", "md:text-sm");
      expect(within(availabilityButton).getByText("We'll help you find the right setup")).toHaveClass(
        "block",
        "text-muted-foreground",
      );
    });

    it("uses the desktop icon treatment and staggered pulse at every viewport", () => {
      usePathname.mockReturnValue("/cart");
      render(<MobileContactBar />);

      const button = screen.getByRole("button", { name: "Check availability" });
      const iconShell = button.querySelector(".availability-cta-icon-shell");
      expect(iconShell).toHaveClass(
        "size-9",
        "bg-primary/18",
        "text-primary",
        "ring-1",
        "ring-primary/35",
      );
      expect(iconShell?.className).not.toMatch(/(?:^|\s)(?:sm|md|lg|xl|2xl):/);
      expect(button.querySelector(".availability-cta-icon")).toHaveClass("size-4");
      const pulses = button.querySelectorAll(".availability-cta-pulse");
      expect(pulses).toHaveLength(2);
      for (const pulse of pulses) {
        expect(pulse).toHaveAttribute("aria-hidden", "true");
        expect(pulse).toHaveClass("bg-primary/40", "opacity-0");
      }
      expect(pulses[1]).toHaveClass("availability-cta-pulse-delay");
    });

    it("opens a unified availability contact sheet on public pages", () => {
      usePathname.mockReturnValue("/packages");
      render(<MobileContactBar />);

      const availabilityButton = screen.getByRole("button", { name: "Check availability" });
      expect(availabilityButton).toBeInTheDocument();
      expect(availabilityButton.querySelector(".availability-cta-icon-shell")).toBeInTheDocument();
      expect(availabilityButton.querySelector("svg")).toHaveClass("availability-cta-icon");
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

    it("stays out of the way during booking and payment actions", () => {
      for (const pathname of ["/booking", "/pay/test-token"]) {
        usePathname.mockReturnValue(pathname);
        const { unmount } = render(<MobileContactBar />);
        expect(screen.queryByRole("button", { name: "Check availability" })).not.toBeInTheDocument();
        unmount();
      }
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
    expect(screen.getByRole("heading", { level: 2, name: "Choose a package" })).toBeInTheDocument();
    expect(screen.getByText("Ready-to-use systems.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("omits optional content when it is not supplied", () => {
    render(
      <Section title="A title">
        <p>Body</p>
      </Section>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "A title" })).toBeInTheDocument();
    expect(screen.queryByText("Packages")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready-to-use systems.")).not.toBeInTheDocument();
  });

  it("supports rendering an h1 when requested", () => {
    render(
      <Section title="Page heading" headingAs="h1">
        <p>Body</p>
      </Section>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page heading" })).toBeInTheDocument();
  });
});

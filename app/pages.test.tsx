import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";
import PackagesPage from "./packages/page";
import ContactPage from "./contact/page";
import FaqPage from "./faq/page";
import HowItWorksPage from "./how-it-works/page";
import GetStartedPage from "./get-started/page";
import { business, faqs, homeHireSteps, howItWorks, packageTiers } from "@/lib/site-content";

vi.mock("@/components/enquiry-form", () => ({
  EnquiryForm: ({ packageName }: { packageName?: string }) => (
    <div aria-label="Enquiry form">{packageName ? `Selected: ${packageName}` : "Enquiry form"}</div>
  ),
}));

vi.mock("@/components/payment-checkout", () => ({
  PaymentCheckout: ({ token }: { token: string }) => <div aria-label="Payment checkout">Payment form for {token}</div>,
}));

describe("static site pages", () => {
  it("home page exposes primary calls to action, package data, and process content", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: business.heroHeading })).toBeInTheDocument();
    for (const line of business.heroHeadingLines) {
      expect(within(screen.getByRole("heading", { level: 1 })).getByText(line)).toHaveClass("block", "whitespace-nowrap");
    }
    expect(screen.getByRole("link", { name: "View packages" })).toHaveAttribute("href", "/packages");
    expect(within(screen.getByRole("region", { name: business.heroHeading })).getByText("Call 0452 316 823").closest("a")).toHaveAttribute("href", "tel:0452316823");
    for (const pkg of packageTiers) {
      expect(screen.getAllByText(pkg.name).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByRole("heading", { name: "No idea where to start? Start here." })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Custom setup" })).not.toBeInTheDocument();
  });

  it("home page keeps the bold introduction uncluttered and offers individual hire and help", () => {
    render(<Home />);

    expect(screen.getByLabelText(business.heroSubheading)).toHaveClass("flex", "flex-wrap", "text-sm");
    for (const event of business.heroSubheading.split(" · ")) {
      expect(within(screen.getByLabelText(business.heroSubheading)).getByText(event)).toHaveClass("whitespace-nowrap");
    }
    expect(screen.getByText(business.heroSupportingText)).toHaveClass("text-base", "text-muted-foreground");
    expect(screen.queryByText("PA & speaker hire in Melbourne")).not.toBeInTheDocument();
    expect(screen.queryByText("Find your sound", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Less figuring it out. More enjoying it.")).not.toBeInTheDocument();
    expect(screen.queryByText("From people who've hired with us")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explore our sound packages." })).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: business.heroHeading });
    expect(hero.querySelector('a[href="tel:0452316823"]')).toHaveClass("bg-none", "shadow-none", "ring-0", "h-12");
    expect(within(hero).getByRole("link", { name: "View packages" })).toHaveClass("rounded-xl", "bg-primary/5", "border-primary/30", "min-h-12");
    expect(within(hero).getByRole("link", { name: "View packages" }).querySelector("svg")).toBeNull();
    expect(screen.queryByRole("group", { name: "Equipment available" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Microphones and a PA speaker set up on an outdoor stage" })).toHaveAttribute("src", expect.stringContaining("home-live-sound.jpg"));
    expect(screen.queryByText("Speakers, mics & mixers")).not.toBeInTheDocument();
    expect(screen.queryByText(/Your playlist\. Your people\./)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Not sure what you need? Ask us." })).toHaveAttribute("href", "/contact");
    expect(screen.queryByText("Just add your playlist.")).not.toBeInTheDocument();
    expect(screen.queryByText("Work things. Live gigs. Your thing.")).not.toBeInTheDocument();
    expect(screen.queryByText("Just need the speakers?")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse equipment" })).not.toBeInTheDocument();
    expect(screen.queryByText("Only need a few items?")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Other ways to hire" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your event isn't a template.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A few questions before the party" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Let's chat" })).toHaveAttribute("href", "/contact");
    const contactHeading = screen.getByRole("heading", { name: "Got a date in mind?" });
    expect(contactHeading).toHaveClass("text-2xl", "sm:text-3xl");
    expect(contactHeading).not.toHaveClass("sm:text-6xl");
    expect(screen.queryByText("Let's get your sound sorted")).not.toBeInTheDocument();
    expect(screen.getByText("Tell us what you're planning and we'll check availability for your dates. Weekends can book out quickly, so we recommend getting your dates sorted ahead of time.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more reviews on Google" })).toHaveAttribute("href", business.googleReviewsUrl);
    expect(screen.queryByText("Why Peppermint Audio?")).not.toBeInTheDocument();
  });

  it("home page summarises hire without promising instant booking confirmation", () => {
    render(<Home />);

    const steps = within(screen.getByRole("region", { name: "No idea where to start? Start here." })).getByRole("list");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);
    for (const step of homeHireSteps) {
      expect(within(steps).getByRole("heading", { level: 3, name: step.title })).toBeInTheDocument();
      expect(within(steps).getByText(step.detail)).toBeInTheDocument();
    }
    expect(screen.getByText(/Your request isn't a confirmed hire just yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The pickup-to-party details" })).toHaveAttribute("href", "/how-it-works");
  });

  it("home page reserves the hero photograph for the desktop layout", () => {
    render(<Home />);

    const photo = screen.getByRole("img", { name: "Microphones and a PA speaker set up on an outdoor stage" });
    expect(photo.parentElement).toHaveClass("hidden", "lg:block");
    expect(screen.getByRole("heading", { level: 1, name: business.heroHeading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View packages" })).toBeInTheDocument();
  });

  it("packages page selects a valid requested package and offers custom enquiries", async () => {
    render(await PackagesPage({ searchParams: Promise.resolve({ package: "big-celebration" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Choose your complete PA package" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Big Celebration Package.*up to 300 people.*\$240/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("Big Celebration Package").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Ask about a custom package").closest("a")).toHaveAttribute(
      "href",
      "/contact?package=custom",
    );
  });

  it("falls back to the first package for an unknown request", async () => {
    render(await PackagesPage({ searchParams: Promise.resolve({ package: "does-not-exist" }) }));

    expect(screen.getByRole("tab", { name: /Speech & Presentation Package.*up to 40 people.*\$65/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("contact page passes a selected package to the enquiry form", async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ package: "standard-party-events" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Get in touch" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enquiry form")).toHaveTextContent("Selected: Standard Party & Events Package");
    expect(screen.getByText("Pickup from Abbotsford 3067. We confirm the exact window after booking.")).toBeInTheDocument();
  });

  it("delegates the payment and confirmation screens to the token-aware checkout", async () => {
    const PaymentPage = (await import("./pay/[token]/page")).default;
    render(await PaymentPage({ params: Promise.resolve({ token: "test-token" }) }));

    expect(screen.queryByRole("heading", { name: "Pay for your hire" })).not.toBeInTheDocument();
    expect(screen.queryByText(/deposit hold may expire/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Payment checkout")).toHaveTextContent("Payment form for test-token");
  });

  it("FAQ page starts closed and opens package advice on request", async () => {
    render(<FaqPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Good sound. Less stress." })).toBeInTheDocument();
    expect(screen.queryByText("A few questions before the party")).not.toBeInTheDocument();
    expect(screen.queryByText("A few questions before your event")).not.toBeInTheDocument();
    for (const question of screen.getAllByRole("button").filter((button) => !button.closest("details"))) {
      expect(question).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.getAllByRole("button").filter((button) => !button.closest("details"))).toHaveLength(5);
    expect(screen.getByText("A few practical bits").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: faqs[0].question }));
    expect(await screen.findByText(faqs[0].answer.split("\n\n")[0])).toBeVisible();
    for (const paragraph of faqs[0].answer.split("\n\n")) {
      expect(screen.getByText(paragraph)).toBeVisible();
    }
    expect(screen.getByRole("link", { name: "Have a look at the packages" })).toHaveAttribute("href", "/packages");
    const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? "");
    expect(schema).toMatchObject({
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  });

  it("FAQ offers individual hire immediately after specific requirements in the owner's voice", async () => {
    render(<FaqPage />);

    const questions = screen.getAllByRole("button").filter((button) => !button.closest("details"));
    expect(questions[3]).toHaveAccessibleName(faqs[3].question);
    expect(questions[4]).toHaveAccessibleName("I just need a couple of speakers, not a whole package. Can I do that?");
    fireEvent.click(questions[4]);
    expect(await screen.findByText(/Whether you're a DJ who already has the rest sorted/)).toBeVisible();
    expect(screen.getByText(/Before you message us saying "How much for just two speakers\?"/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Have a browse of the individual gear" })).toHaveAttribute("href", "/equipment");
  });

  it("FAQ answers can be opened and closed and retain the owner's specific-requirement copy", async () => {
    render(<FaqPage />);

    const trigger = screen.getByRole("button", { name: faqs[3].question });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(/Joe mama's neighbour's third kid/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse packages & add-ons" })).toHaveAttribute("href", "/packages");
    expect(screen.getByRole("link", { name: "Browse individual equipment" })).toHaveAttribute("href", "/equipment");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("FAQ keeps practical details collapsed and offers accurate pricing, booking and contact help", async () => {
    render(<FaqPage />);

    const details = screen.getByText("A few practical bits").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("A few practical bits"));
    expect(details).toHaveAttribute("open");
    const pricing = within(details).getByRole("button", { name: faqs[5].question });
    fireEvent.click(pricing);
    expect(await screen.findByText(faqs[5].answer.split("\n\n")[0])).toBeVisible();
    fireEvent.click(within(details).getByRole("button", { name: faqs[7].question }));
    expect(await screen.findByText(/Sending the request doesn't confirm the hire just yet/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Call 0452 316 823" })).toHaveAttribute("href", "tel:0452316823");
  });

  it("how-it-works page explains the request lifecycle and links to catalogues", () => {
    render(<HowItWorksPage />);

    expect(screen.getByRole("heading", { level: 1, name: "How It Works" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(howItWorks).toHaveLength(3);
    for (const step of howItWorks) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
      for (const paragraph of step.detail.split("\n\n")) {
        expect(within(screen.getByRole("region", { name: step.title })).getByText(paragraph)).toBeInTheDocument();
      }
    }
    expect(screen.getByText(/finalise the details before confirming your hire/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "get in touch" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "The FAQ is a good place to start." })).toHaveAttribute("href", "/faq");
    expect(screen.getByText("Browse packages").closest("a")).toHaveAttribute("href", "/packages");
    expect(screen.getByText("Hire individual equipment").closest("a")).toHaveAttribute("href", "/equipment");
  });

  it("get-started page contains package setup guidance and equipment help links", () => {
    render(<GetStartedPage />);

    expect(screen.getByRole("heading", { name: "Set up your sound system" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your setup" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Bose S1 Pro/i })[0]).toBeInTheDocument();
    expect(screen.getByText("Bose S1 Pro", { selector: "a" })).toHaveAttribute(
      "href",
      expect.stringContaining("youtube.com/results"),
    );
    expect(screen.getByText(/contact Peppermint Audio before powering up/i)).toBeInTheDocument();
  });

});

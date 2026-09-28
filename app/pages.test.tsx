import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";
import PackagesPage from "./packages/page";
import ContactPage from "./contact/page";
import FaqPage from "./faq/page";
import HowItWorksPage from "./how-it-works/page";
import GetStartedPage from "./get-started/page";
import BookingPage from "./booking/page";
import { faqs, howItWorks, packageTiers } from "@/lib/site-content";

vi.mock("@/components/enquiry-form", () => ({
  EnquiryForm: ({ packageName }: { packageName?: string }) => (
    <div aria-label="Enquiry form">{packageName ? `Selected: ${packageName}` : "Enquiry form"}</div>
  ),
}));

vi.mock("@/components/booking-form", () => ({
  BookingForm: () => <div aria-label="Booking form">Booking form</div>,
}));

describe("static site pages", () => {
  it("home page exposes primary calls to action, package data, and process content", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Audio Rental for Melbourne Events" })).toBeInTheDocument();
    expect(screen.getByText("Book now").closest("a")).toHaveAttribute("href", "/booking");
    expect(screen.getByText("View Packages").closest("a")).toHaveAttribute("href", "/packages");
    for (const pkg of packageTiers) {
      expect(screen.getByText(pkg.name)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "How hire works" })).toBeInTheDocument();
    expect(screen.getByText("Build a custom package").closest("a")).toHaveAttribute(
      "href",
      "/contact?package=custom",
    );
  });

  it("packages page selects a valid requested package and offers custom enquiries", async () => {
    render(await PackagesPage({ searchParams: Promise.resolve({ package: "big-celebration" }) }));

    expect(screen.getByRole("heading", { name: "Choose your complete PA package" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Big Celebration Package" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Big Celebration Package").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Ask about a custom package").closest("a")).toHaveAttribute(
      "href",
      "/contact?package=custom",
    );
  });

  it("booking page explains that requests require confirmation", () => {
    render(<BookingPage />);

    expect(screen.getByRole("heading", { name: "Making a booking" })).toBeInTheDocument();
    expect(screen.getByText(/The booking is only confirmed after Peppermint Audio reviews availability/)).toBeInTheDocument();
    expect(screen.getByLabelText("Booking form")).toBeInTheDocument();
  });

  it("falls back to the first package for an unknown request", async () => {
    render(await PackagesPage({ searchParams: Promise.resolve({ package: "does-not-exist" }) }));

    expect(screen.getByRole("tab", { name: "Speech & Presentation Package" })).toHaveAttribute("aria-selected", "true");
  });

  it("contact page passes a selected package to the enquiry form", async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ package: "standard-party-events" }) }));

    expect(screen.getByRole("heading", { name: "Get a Quote" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enquiry form")).toHaveTextContent("Selected: Standard Party & Events Package");
    expect(screen.getByText("Pickup from Abbotsford 3067. We confirm the exact window after booking.")).toBeInTheDocument();
  });

  it("FAQ page renders questions and the first answer by default", () => {
    render(<FaqPage />);

    expect(screen.getByRole("heading", { name: "Frequently Asked Questions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: faqs[0].question })).toBeInTheDocument();
    expect(screen.getByText(faqs[0].answer)).toBeInTheDocument();
  });

  it("how-it-works page labels every step and links to availability", () => {
    render(<HowItWorksPage />);

    for (const [index, step] of howItWorks.entries()) {
      expect(screen.getByText(`Step ${index + 1}`)).toBeInTheDocument();
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }
    expect(screen.getByText("Check availability").closest("a")).toHaveAttribute("href", "/contact");
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

  it("booking page introduces the booking form", () => {
    render(<BookingPage />);

    expect(screen.getByRole("heading", { name: "Making a booking" })).toBeInTheDocument();
    expect(screen.getByLabelText("Booking form")).toBeInTheDocument();
  });
});

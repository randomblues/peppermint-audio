import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";

import { BookingForm } from "./booking-form";

const mockCart = vi.hoisted(() => ({
    items: [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 }],
    hireDates: { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" },
    clearCart: vi.fn(),
}));

vi.mock("@/components/cart-provider", () => ({ useCart: () => mockCart }));
vi.mock("@/lib/date-utils", () => ({ getMelbourneToday: () => "2026-10-09" }));

describe("BookingForm", () => {
  beforeEach(() => {
    mockCart.hireDates = { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" };
    mockCart.clearCart.mockClear();
  });

  it("restores contact details under Strict Mode and uses only cart dates", () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Pricing", lastName: "Test", email: "pricing@example.com", mobile: "0400000000",
      pickupDate: "2026-10-01", dropoffDate: "2026-10-02",
    }));
    render(<StrictMode><BookingForm /></StrictMode>);
    expect(screen.getByLabelText("First name")).toHaveValue("Pricing");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Hire total · 3 nights")).toBeInTheDocument();
    const draft = JSON.parse(window.localStorage.getItem("peppermint-audio-booking-draft")!);
    expect(draft.firstName).toBe("Pricing");
    expect(draft).not.toHaveProperty("pickupDate");
    expect(draft).not.toHaveProperty("dropoffDate");
  });

  it("uses cart dates for totals and offers date changes only through the cart", () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex", lastName: "Smith", email: "alex@example.com", mobile: "0412345678",
      eventType: "Party", eventAddress: "1 Example Street", pickupDate: "2026-10-20",
      dropoffDate: "2026-10-23", pickupTime: "10:00", dropoffTime: "12:00",
    }));
    const { rerender } = render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Hire total · 3 nights")).toBeInTheDocument();
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText("$165.00").tagName).toBe("S");
    expect(screen.getByText("You save $55.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "23 October 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change dates" })).toHaveAttribute("href", "/cart");
    expect(screen.getByText(/Pickup: 20 October 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pickup time/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drop-off time/ })).toBeInTheDocument();
    mockCart.hireDates.dropoffDate = "2026-10-21";
    rerender(<BookingForm />);
    expect(screen.getByText("Hire total · 1 night")).toBeInTheDocument();
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("$55.00 each / night")).toBeInTheDocument();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("shows the request receipt, reference and next steps without confirming the booking", async () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex", lastName: "Smith", email: "alex@example.com", mobile: "0412345678",
      eventType: "Wedding", eventAddress: "1 Example Street", pickupTime: "10:00", dropoffTime: "12:00",
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ bookingReference: "PA-123456789012" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<BookingForm />);
    for (let step = 0; step < 3; step++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.drop(screen.getByTestId("photo-id-dropzone"), {
      dataTransfer: { files: [
        new File(["front"], "front.png", { type: "image/png" }),
        new File(["back"], "back.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit a Booking Request" }));

    expect(await screen.findByRole("heading", { name: "Thanks — we have received your request" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your request is not confirmed yet.");
    expect(screen.getByText("PA-123456789012")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Request received");
    expect(screen.getByRole("list")).toHaveTextContent("Availability review");
    expect(screen.getByRole("list")).toHaveTextContent("We will be in touch");
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    expect(mockCart.clearCart).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("peppermint-audio-booking-draft")).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses a step-by-step flow and moves from your details to event details", () => {
    render(<BookingForm />);

    expect(screen.getByText("Booking details")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Event address")).not.toBeInTheDocument();
    expect(screen.queryByText("Photo ID and terms")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event address")).toBeInTheDocument();
    expect(screen.queryByText(/Bose S1 Pro PA Speaker/)).not.toBeInTheDocument();
  });

  it("sends direct visits without dates back to the cart", () => {
    mockCart.hireDates = { pickupDate: "", dropoffDate: "" };
    render(<BookingForm />);
    expect(screen.getByText("Choose your hire dates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to cart" })).toHaveAttribute("href", "/cart");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("does not show step 4 red validation messages before submit", () => {
    window.localStorage.setItem(
      "peppermint-audio-booking-draft",
      JSON.stringify({
        firstName: "Alex",
        lastName: "Smith",
        email: "alex@example.com",
        mobile: "0412345678",
        eventType: "Wedding",
        eventAddress: "1 Smith St, Abbotsford",
        pickupDate: "2026-10-20",
        dropoffDate: "2026-10-23",
        pickupTime: "10:00",
        dropoffTime: "12:00",
        additionalDetails: "",
      }),
    );

    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Photo ID and terms" })).toBeInTheDocument();
    expect(screen.queryByText("Please upload the front and back of your photo ID.")).not.toBeInTheDocument();
    expect(screen.queryByText("Please confirm that you have read and agree to the terms")).not.toBeInTheDocument();
  });

  it("supports drag and drop photo ID uploads on step 4", () => {
    window.localStorage.setItem(
      "peppermint-audio-booking-draft",
      JSON.stringify({
        firstName: "Alex",
        lastName: "Smith",
        email: "alex@example.com",
        mobile: "0412345678",
        eventType: "Wedding",
        eventAddress: "1 Smith St, Abbotsford",
        pickupDate: "2026-10-20",
        dropoffDate: "2026-10-23",
        pickupTime: "10:00",
        dropoffTime: "12:00",
      }),
    );

    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const frontFile = new File(["front"], "front-id.png", { type: "image/png" });
    expect(screen.getByText("Upload clear photos of the front and back of your valid photo ID.")).toBeInTheDocument();
    expect(screen.queryByText(/automatically resized|PDF files must/)).not.toBeInTheDocument();
    const backFile = new File(["back"], "back-id.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("photo-id-dropzone"), {
      dataTransfer: { files: [frontFile, backFile] },
    });

    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove back-id.png" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove back-id.png" }));
    expect(screen.queryByRole("button", { name: "Remove back-id.png" })).not.toBeInTheDocument();
    expect(screen.queryByText("Please upload the front and back of your photo ID.")).not.toBeInTheDocument();
  });
});

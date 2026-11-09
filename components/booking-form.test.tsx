import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";

import { BookingForm } from "./booking-form";

const mockTrackBookingSubmission = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

const mockCart = vi.hoisted(() => ({
    items: [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 }],
    hireDates: { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" },
    clearCart: vi.fn(),
}));

vi.mock("@/components/cart-provider", () => ({ useCart: () => mockCart }));
vi.mock("@/lib/date-utils", () => ({ getMelbourneToday: () => "2026-10-09" }));
vi.mock("@/lib/google-ads", () => ({
  trackGoogleAdsBookingSubmission: mockTrackBookingSubmission,
}));

async function verifyContactMobile() {
  fireEvent.click(screen.getByRole("button", { name: /Send verification code/ }));
  await screen.findByLabelText("Verification code");
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify number" }));
  await screen.findByText("Mobile number verified.");
}

describe("BookingForm", () => {
  beforeEach(() => {
    mockCart.hireDates = { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" };
    mockCart.clearCart.mockClear();
    mockTrackBookingSubmission.mockClear();
    mockFetch.mockReset().mockImplementation(async (url: string, options: { body?: FormData | string } = {}) => {
      if (url === "/api/phone-verification") {
        const request = JSON.parse(String(options.body)) as { action: string };
        return {
          ok: true,
          json: async () => request.action === "send"
            ? { challengeToken: "v".repeat(43) }
            : { verified: true },
        };
      }
      return { ok: true, json: async () => ({ bookingReference: "PA-123456789012" }) };
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  it("restores contact details under Strict Mode and uses only cart dates", async () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Pricing", lastName: "Test", email: "pricing@example.com", mobile: "0400000000",
      pickupDate: "2026-10-01", dropoffDate: "2026-10-02",
    }));
    render(<StrictMode><BookingForm /></StrictMode>);
    expect(screen.getByLabelText("First name")).toHaveValue("Pricing");
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Hire total · 3 nights")).toBeInTheDocument();
    const draft = JSON.parse(window.localStorage.getItem("peppermint-audio-booking-draft")!);
    expect(draft.firstName).toBe("Pricing");
    expect(draft).not.toHaveProperty("pickupDate");
    expect(draft).not.toHaveProperty("dropoffDate");
  });

  it("uses cart dates for totals and offers date changes only through the cart", async () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex", lastName: "Smith", email: "alex@example.com", mobile: "0412345678",
      eventType: "Party", eventAddress: "1 Example Street", pickupDate: "2026-10-20",
      dropoffDate: "2026-10-23", pickupTime: "10:00", dropoffTime: "12:00",
    }));
    const { rerender } = render(<BookingForm />);
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Hire total · 3 nights")).toBeInTheDocument();
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText("$165.00").tagName).toBe("S");
    expect(screen.getByText("You save $55.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "23 October 2026" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change dates" })).toHaveAttribute("href", "/cart");
    expect(screen.getByText(/Pickup: 20 October 2026/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Pickup time" })).toHaveValue("10:00");
    expect(screen.getByRole("combobox", { name: "Pickup time" })).toHaveDisplayValue("10:00");
    expect(screen.getByRole("combobox", { name: "Drop-off time" })).toHaveValue("12:00");
    expect(screen.getByRole("combobox", { name: "Drop-off time" })).toHaveDisplayValue("12:00");
    mockCart.hireDates.dropoffDate = "2026-10-21";
    rerender(<BookingForm />);
    expect(screen.getByText("Hire total · 1 night")).toBeInTheDocument();
    expect(screen.getByText("$55.00")).toBeInTheDocument();
    expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [
        new File(["front"], "front-id.png", { type: "image/png" }),
        new File(["back"], "back-id.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("$55.00 each / night")).toBeInTheDocument();
  });

  it("keeps extra-details copy neutral about the pickup-and-drop-off hire", async () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex", lastName: "Smith", email: "alex@example.com", mobile: "0412345678",
      eventType: "Party", eventAddress: "1 Example Street", pickupTime: "10:00", dropoffTime: "12:00",
    }));
    render(<BookingForm />);

    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [
        new File(["front"], "front-id.png", { type: "image/png" }),
        new File(["back"], "back-id.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Review your hire and terms" })).toBeInTheDocument();
    expect(screen.getByText("Check your selected items, add any details, and accept the hire terms to submit your request.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selected hire items" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anything else?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Additional details or special requests (optional)")).toHaveAttribute(
      "placeholder",
      "Share any additional details or special requests for your booking...",
    );
    expect(screen.queryByText(/venue access|access requirements|setup notes/i)).not.toBeInTheDocument();
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
    render(<BookingForm />);
    await verifyContactMobile();
    for (let step = 0; step < 2; step++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [
        new File(["front"], "front.png", { type: "image/png" }),
      ] },
    });
    fireEvent.drop(screen.getByTestId("photo-id-dropzone"), {
      dataTransfer: { files: [
        new File(["back"], "back.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
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
    expect(mockTrackBookingSubmission).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("peppermint-audio-booking-draft")).toBeNull();
    const bookingCalls = mockFetch.mock.calls.filter(([url]) => url === "/api/booking");
    expect(bookingCalls).toHaveLength(1);
    const bookingForm = bookingCalls[0][1].body as FormData;
    expect(bookingForm.get("phoneVerificationToken")).toBe("v".repeat(43));
    const submittedFiles = bookingForm.getAll("idFiles");
    expect(submittedFiles).toEqual([
      expect.objectContaining({ name: "front.png" }),
      expect.objectContaining({ name: "back.png" }),
    ]);
  });

  it("uses a step-by-step flow and requires phone verification before continuing", async () => {
    render(<BookingForm />);

    expect(screen.getByText("Booking details")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Event address")).not.toBeInTheDocument();
    expect(screen.queryByText("Photo ID")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Verify your mobile number before continuing.");
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Event address")).toBeInTheDocument();
    expect(screen.queryByText(/Bose S1 Pro PA Speaker/)).not.toBeInTheDocument();
  });

  it("clears phone verification when the customer changes their mobile number", async () => {
    render(<BookingForm />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345678" } });
    await verifyContactMobile();

    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345679" } });

    expect(screen.queryByText("Mobile number verified.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Verify your mobile number before continuing.");
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("allows a new verification after booking submission fails", async () => {
    mockFetch.mockImplementation(async (url: string, options: { body?: FormData | string } = {}) => {
      if (url === "/api/phone-verification") {
        const request = JSON.parse(String(options.body)) as { action: string };
        return {
          ok: true,
          json: async () => request.action === "send"
            ? { challengeToken: "v".repeat(43) }
            : { verified: true },
        };
      }
      return { ok: false, json: async () => ({ error: "Booking submission failed." }) };
    });
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      mobile: "0412345678",
      eventType: "Wedding",
      eventAddress: "1 Example Street",
      pickupTime: "10:00",
      dropoffTime: "12:00",
    }));
    render(<BookingForm />);
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [
        new File(["front"], "front.png", { type: "image/png" }),
        new File(["back"], "back.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit a Booking Request" }));

    expect(await screen.findByText("Please verify your mobile number again before retrying.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification code" })).toBeInTheDocument();
  });

  it("sends direct visits without dates back to the cart", () => {
    mockCart.hireDates = { pickupDate: "", dropoffDate: "" };
    render(<BookingForm />);
    expect(screen.getByText("Choose your hire dates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to cart" })).toHaveAttribute("href", "/cart");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
  });

  it("puts photo ID before review and only shows final-step errors after submit", async () => {
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
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Photo ID" })).toBeInTheDocument();
    expect(screen.queryByText("Hire total · 3 nights")).not.toBeInTheDocument();
    expect(screen.queryByText("Please upload the front and back of your photo ID.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Choose files"), {
      target: { files: [
        new File(["front"], "front-id.png", { type: "image/png" }),
        new File(["back"], "back-id.png", { type: "image/png" }),
      ] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review your hire and terms" })).toBeInTheDocument();
    expect(screen.getByText("Hire total · 3 nights")).toBeInTheDocument();
    expect(screen.queryByText("Please confirm that you have read and agree to the terms")).not.toBeInTheDocument();
  });

  it.each(["picker", "drop"] as const)("adds photo IDs separately using the %s, preserves files at the limit and allows replacement after removal", async (method) => {
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
    await verifyContactMobile();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const frontFile = new File(["front"], "front-id.png", { type: "image/png" });
    expect(screen.getByText("Upload clear photos of the front and back of your valid photo ID.")).toBeInTheDocument();
    expect(screen.queryByText(/automatically resized|PDF files must/)).not.toBeInTheDocument();
    const backFile = new File(["back"], "back-id.png", { type: "image/png" });
    const addFiles = (files: File[]) => {
      if (method === "picker") {
        fireEvent.change(screen.getByLabelText("Choose files"), { target: { files } });
      } else {
        fireEvent.drop(screen.getByTestId("photo-id-dropzone"), { dataTransfer: { files } });
      }
    };
    const replacementFile = new File(["replacement"], "replacement.png", { type: "image/png" });
    addFiles([frontFile, backFile, replacementFile]);
    expect(screen.getByText(/You can upload 2 files total/)).toBeInTheDocument();
    expect(screen.getByText("No files selected yet.")).toBeInTheDocument();
    addFiles([frontFile]);
    addFiles([]);
    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    addFiles([backFile, replacementFile]);
    expect(screen.getByText(/You can upload 2 files total/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove back-id.png" })).not.toBeInTheDocument();
    addFiles([backFile]);

    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove back-id.png" })).toBeInTheDocument();
    expect(screen.queryByText(/You can upload 2 files total/)).not.toBeInTheDocument();
    addFiles([replacementFile]);
    expect(screen.getByText(/You can upload 2 files total/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove back-id.png" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove replacement.png" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove back-id.png" }));
    expect(screen.queryByRole("button", { name: "Remove back-id.png" })).not.toBeInTheDocument();
    addFiles([replacementFile]);
    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove replacement.png" })).toBeInTheDocument();
    expect(screen.queryByText(/You can upload 2 files total/)).not.toBeInTheDocument();
    expect(screen.queryByText("Please upload the front and back of your photo ID.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove front-id.png" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove replacement.png" }));
    addFiles([frontFile, backFile]);
    expect(screen.getByRole("button", { name: "Remove front-id.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove back-id.png" })).toBeInTheDocument();
    expect(screen.queryByText(/You can upload 2 files total/)).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "./booking-form";

vi.mock("@/components/cart-provider", () => ({
  useCart: () => ({
    items: [{ id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 1 }],
    clearCart: vi.fn(),
  }),
}));

describe("BookingForm", () => {
  afterEach(() => {
    window.localStorage.clear();
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

  it("clears drop-off date and time when pickup date is moved later", () => {
    window.localStorage.setItem(
      "peppermint-audio-booking-draft",
      JSON.stringify({
        firstName: "Alex",
        lastName: "Smith",
        email: "alex@example.com",
        mobile: "0412345678",
        pickupDate: "2026-10-15",
        dropoffDate: "2026-10-16",
        dropoffTime: "14:00",
      }),
    );

    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("button", { name: "16 October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drop-off time/ })).toHaveTextContent("2:00 PM");

    fireEvent.click(screen.getByRole("button", { name: "15 October 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "20/10/2026" }));

    expect(screen.getByRole("button", { name: "Select a date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drop-off time/ })).toHaveTextContent("Choose a time");
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

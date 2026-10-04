import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as googleAds from "@/lib/google-ads";
import { BookingForm } from "./booking-form";

function chooseDate(label: string) {
  fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") !== null && !button.hasAttribute("disabled"))!);
}

function advanceToPackage() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345678" } });
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "Birthday party" } });
  fireEvent.change(screen.getByLabelText("Event address"), { target: { value: "1 Smith Street, Melbourne" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  chooseDate("Select a date");
  chooseDate("Select a date");
  fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
  fireEvent.change(screen.getByLabelText("Pickup time hour"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: /Drop-off time/ }));
  fireEvent.change(screen.getByLabelText("Drop-off time hour"), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: "PM" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("BookingForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores saved form details and the current step after a refresh", async () => {
    window.localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      step: 1,
      values: {
        email: "saved@example.com",
        firstName: "Saved",
        lastName: "Customer",
        mobile: "0412345678",
        eventType: "Wedding",
      },
    }));

    render(<BookingForm />);

    expect(await screen.findByText("Event details")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Wedding")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("saved@example.com")).not.toBeInTheDocument();
  });

  it("gates each step and supports package and add-on selection", () => {
    render(<BookingForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 7")).toBeInTheDocument();

    advanceToPackage();
    expect(screen.getByText("Choose your package")).toBeInTheDocument();
    const packages = screen.getAllByRole("radio");
    fireEvent.click(packages[0]);
    expect(packages[0]).toBeChecked();

    expect(screen.queryByText("Add-ons")).not.toBeInTheDocument();
  });

  it("preselects a package when opened from a package page", () => {
    render(<BookingForm initialPackageSlug="standard-party-events" />);
    advanceToPackage();

    const selectedPackage = screen.getByRole("radio", {
      name: /Standard Party & Events Package/i,
    });
    expect(selectedPackage).toBeChecked();
    expect(screen.getByText("Ideal for up to 120 people").parentElement).toHaveClass("border-t");
  });

  it("locks the cart selection instead of asking customers to choose a package again", () => {
    render(<BookingForm cartItems={[
      { id: "package:standard-party-events", name: "Standard Party & Events Package", kind: "package", price: 180, quantity: 1 },
      { id: "equipment:shure-sm58:Single microphone", name: "Shure SM58", kind: "equipment", option: "Single microphone", price: 15, quantity: 2 },
    ]} />);
    advanceToPackage();

    expect(screen.getByText("Your cart selection")).toBeInTheDocument();
    expect(screen.getByText("Standard Party & Events Package")).toBeInTheDocument();
    expect(screen.getByText("2 × Shure SM58")).toBeInTheDocument();
    expect(screen.queryByText("Choose your package")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to your cart" })).toHaveAttribute("href", "/cart");
  });

  it("shows booking API errors and the success confirmation", async () => {
    const trackSubmission = vi.spyOn(googleAds, "trackGoogleAdsBookingSubmission");
    const request = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => null,
    });
    vi.stubGlobal("fetch", request);
    render(<BookingForm />);
    advanceToPackage();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("If applicable, mention any additional details or requests below"), {
      target: { value: "Please call before pickup." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const files = [
      new File(["front"], "front.jpg", { type: "image/jpeg" }),
      new File(["back"], "back.jpg", { type: "image/jpeg" }),
    ];
    const fileInput = screen.getByText(/Upload up to 2 supported files/).parentElement?.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, { target: { files } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: "Submit booking details" }));
    expect(await screen.findByText("Your photo ID files are too large. Please choose smaller images and try again.")).toBeInTheDocument();
    expect(trackSubmission).not.toHaveBeenCalled();

    request.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    fireEvent.click(screen.getByRole("button", { name: "Submit booking details" }));
    expect(await screen.findByText("Your booking request has been received")).toBeInTheDocument();
    expect(screen.getByText("Please note that your booking has not yet been confirmed.")).toBeInTheDocument();
    expect(screen.getByText(/Once your booking is confirmed/)).toBeInTheDocument();
    expect(trackSubmission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.localStorage.getItem("peppermint-audio-booking-draft")).toBeNull());
  });
});

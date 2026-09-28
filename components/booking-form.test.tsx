import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingForm } from "./booking-form";

function chooseDate(label: string) {
  fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") !== null)!);
}

function advanceToPackage() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "0412345678" } });
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "Birthday party" } });
  fireEvent.change(screen.getByLabelText("Event address"), { target: { value: "1 Smith Street, Melbourne" } });
  fireEvent.change(screen.getByLabelText("Estimated guests"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  chooseDate("Select a date");
  chooseDate("Select a date");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("BookingForm", () => {
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

    const addOn = screen.queryByRole("checkbox", { name: /extra|subwoofer|microphone/i });
    if (addOn) {
      expect(screen.getByText("Add-ons")).toBeInTheDocument();
      fireEvent.click(addOn);
      expect(addOn).toBeChecked();
    }
  });

  it("preselects a package when opened from a package page", () => {
    render(<BookingForm initialPackageSlug="standard-party-events" />);
    advanceToPackage();

    const selectedPackage = screen.getByRole("radio", {
      name: /Standard Party & Events Package/i,
    });
    expect(selectedPackage).toBeChecked();
    expect(screen.getByText("Ideal for 60-120 people").parentElement).toHaveClass("border-t");
  });

  it("shows booking API errors and the success confirmation", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Booking service unavailable" }),
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
    expect(await screen.findByText("Booking service unavailable")).toBeInTheDocument();

    request.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    fireEvent.click(screen.getByRole("button", { name: "Submit booking details" }));
    expect(await screen.findByText("Your booking request has been submitted")).toBeInTheDocument();
    expect(screen.getByText("Please note that your booking has not yet been confirmed.")).toBeInTheDocument();
    expect(screen.getByText(/Once we confirm it from our admin console/)).toBeInTheDocument();
  });
});

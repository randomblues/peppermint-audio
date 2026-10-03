import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as googleAds from "@/lib/google-ads";
import { EnquiryForm } from "./enquiry-form";

function fillEnquiry() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alex Smith" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "0412345678" } });
  fireEvent.change(screen.getByLabelText("Event Type"), { target: { value: "Birthday party" } });
  fireEvent.change(screen.getByLabelText("Estimated Guests"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Event Details"), { target: { value: "A party with speakers and microphones." } });
  fireEvent.click(screen.getByRole("button", { name: /date/i }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") !== null && !button.hasAttribute("disabled"))!);
}

describe("EnquiryForm", () => {
  it("validates required fields before submitting", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<EnquiryForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
    expect(await screen.findByText("Please enter your name")).toBeInTheDocument();
    expect(screen.getByText("Please select an event date")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it("shows an API error and then the success confirmation", async () => {
    const trackConversion = vi.spyOn(googleAds, "trackGoogleAdsConversion");
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Service unavailable" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", request);
    render(<EnquiryForm />);
    fillEnquiry();
    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    expect(trackConversion).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));
    expect(await screen.findByText("Enquiry sent")).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
    expect(trackConversion).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[1][0]).toBe("/api/enquiry");
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
      attribution: {},
    });
  });

  it("shows a visible error when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<EnquiryForm />);
    fillEnquiry();

    fireEvent.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(await screen.findByText("Could not send enquiry right now. Please check your connection and try again.")).toBeInTheDocument();
  });
});

import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartProvider, useCart } from "./cart-provider";
import { CartView } from "./cart-view";
import { BookingForm } from "./booking-form";

vi.mock("@/lib/date-utils", () => ({ getMelbourneToday: () => "2026-10-09" }));

const datesKey = "peppermint-audio-hire-dates";
const cartItems = [
  { id: "package:standard-party-events", name: "Standard Party & Events Package", kind: "package", price: 160, quantity: 1 },
  { id: "equipment:bose-s1-pro:Single speaker", name: "Bose S1 Pro", kind: "equipment", price: 55, quantity: 2 },
];

function HireDatesControls() {
  const { hireDates, setHireDates, clearCart } = useCart();
  return (
    <>
      <output>{JSON.stringify(hireDates)}</output>
      <button onClick={() => setHireDates({ pickupDate: "2026-10-20", dropoffDate: "2026-10-23" })}>Set dates</button>
      <button onClick={clearCart}>Clear selection</button>
    </>
  );
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("CartProvider hire dates", () => {
  it("restores and persists a single hire range under Strict Mode", async () => {
    const dates = { pickupDate: "2026-10-20", dropoffDate: "2026-10-23" };
    localStorage.setItem(datesKey, JSON.stringify(dates));
    render(<StrictMode><CartProvider><HireDatesControls /></CartProvider></StrictMode>);
    expect(screen.getByRole("status")).toHaveTextContent(JSON.stringify(dates));
    expect(JSON.parse(localStorage.getItem(datesKey)!)).toEqual(dates);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(datesKey)!)).toEqual({ pickupDate: "", dropoffDate: "" }));
  });

  it.each([
    '{"pickupDate":"2026-02-30","dropoffDate":"2026-03-01"}',
    '{"pickupDate":"2026-10-23","dropoffDate":"2026-10-20"}',
    '{"pickupDate":42,"dropoffDate":null}',
    'not-json',
  ])("reports invalid stored dates and requires a fresh selection: %s", (stored) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem(datesKey, stored);
    render(<CartProvider><HireDatesControls /></CartProvider>);
    expect(warning).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent('{"pickupDate":"","dropoffDate":""}');
  });

  it("updates the full cart total live and carries the range into booking", async () => {
    localStorage.setItem("peppermint-audio-cart", JSON.stringify(cartItems));
    localStorage.setItem(datesKey, JSON.stringify({ pickupDate: "2026-10-20", dropoffDate: "2026-10-21" }));
    const { rerender } = render(<CartProvider><CartView /></CartProvider>);
    expect(screen.getByText("$270.00")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("End date"));
    fireEvent.click(screen.getByRole("button", { name: "23/10/2026" }));
    expect(screen.getByText("$540.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity for Standard Party & Events Package" }));
    expect(screen.getByText("$860.00")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(datesKey)!)).toEqual({ pickupDate: "2026-10-20", dropoffDate: "2026-10-23" });

    localStorage.setItem("peppermint-audio-booking-draft", JSON.stringify({
      firstName: "Alex", lastName: "Smith", email: "alex@example.com", mobile: "0412345678",
      eventType: "Party", eventAddress: "1 Example Street", pickupTime: "10:00", dropoffTime: "12:00",
    }));
    rerender(<CartProvider><BookingForm /></CartProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Pickup: 20 October 2026/)).toBeInTheDocument();
    expect(screen.getByText("$860.00")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pickup date")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pickup time/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ bookingReference: "PA-QA" }), { status: 200 }));
    fireEvent.drop(screen.getByTestId("photo-id-dropzone"), {
      dataTransfer: { files: [new File(["front"], "front.png", { type: "image/png" }), new File(["back"], "back.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit a Booking Request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0][1]?.body;
    expect(request).toBeInstanceOf(FormData);
    if (!(request instanceof FormData)) throw new Error("Expected multipart booking request.");
    expect(request.get("pickupDate")).toBe("2026-10-20");
    expect(request.get("dropoffDate")).toBe("2026-10-23");
    expect(request.get("pickupTime")).toBe("10:00");
    expect(request.get("dropoffTime")).toBe("12:00");
    expect(JSON.parse(String(request.get("hireLineItems")))).toHaveLength(2);
    await screen.findByText("Thanks — we have received your request");
    expect(JSON.parse(localStorage.getItem(datesKey)!)).toEqual({ pickupDate: "", dropoffDate: "" });
  });
});

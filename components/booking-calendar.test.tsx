import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BookingCalendar } from "./booking-calendar";

afterEach(() => vi.unstubAllGlobals());
describe("customer calendar page", () => {
  it("offers both calendar formats for each event at the correct Melbourne times", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      reference: "PA-123456", events: [
        { kind: "pickup", date: "2026-11-10", time: "10:00" },
        { kind: "dropoff", date: "2026-11-11", time: "18:00" },
      ],
    })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    const pickup = await screen.findByRole("article", { name: "Pickup calendar event" });
    const dropoff = screen.getByRole("article", { name: "Drop-off calendar event" });
    expect(pickup).toHaveTextContent("10:00 am");
    expect(dropoff).toHaveTextContent("6:00 pm");
    expect(within(pickup).getByRole("link", { name: /Google Calendar/ })).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(dropoff).getByRole("link", { name: /Apple \/ Outlook/ })).toHaveAttribute("href", `/api/calendar/${"a".repeat(22)}/dropoff`);
  });
  it("explains an unavailable link without exposing internal errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Private diagnostic", { status: 500 })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Calendar details could not be loaded");
    expect(screen.queryByText("Private diagnostic")).not.toBeInTheDocument();
  });
});

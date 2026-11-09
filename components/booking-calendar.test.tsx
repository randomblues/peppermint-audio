import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BookingCalendar } from "./booking-calendar";

afterEach(() => vi.unstubAllGlobals());
describe("customer calendar page", () => {
  it("shows one hire card with both calendar actions and the correct pickup and drop-off times", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      reference: "PA-123456", events: [
        { kind: "pickup", date: "2026-11-10", time: "10:00" },
        { kind: "dropoff", date: "2026-11-11", time: "18:00" },
      ],
    })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    const hire = await screen.findByRole("article", { name: "Hire calendar event" });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(hire).toHaveTextContent("10:00 am");
    expect(hire).toHaveTextContent("6:00 pm");
    expect(hire).not.toHaveTextContent(/Google Calendar saves|Apple \/ Outlook saves|all-day/i);
    const google = within(hire).getByRole("link", { name: /Google Calendar/ });
    expect(google).toHaveAttribute("rel", "noopener noreferrer");
    expect(new URL(google.getAttribute("href")!).searchParams.get("dates")).toBe("20261109T230000Z/20261111T070000Z");
    expect(within(hire).getByRole("link", { name: /Apple \/ Outlook/ })).toHaveAttribute("href", `/api/calendar/${"a".repeat(22)}/hire`);
  });
  it.each([
    ["10:00", null], [null, "18:00"], [null, null],
  ])("keeps implementation explanations private with pickup time %s and drop-off time %s", async (pickupTime, dropoffTime) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      reference: "PA-123456", events: [
        { kind: "pickup", date: "2026-11-10", time: pickupTime },
        { kind: "dropoff", date: "2026-11-11", time: dropoffTime },
      ],
    })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    const hire = await screen.findByRole("article", { name: "Hire calendar event" });
    expect(hire).toHaveTextContent("Time to be arranged");
    expect(hire).not.toHaveTextContent(/Google Calendar saves|Apple \/ Outlook saves|all-day/i);
    expect(within(hire).getByRole("link", { name: /Google Calendar/ })).toHaveAttribute(
      "href", expect.stringContaining("dates=20261110%2F20261112"),
    );
    expect(within(hire).getByRole("link", { name: /Apple \/ Outlook/ })).toHaveAttribute("href", `/api/calendar/${"a".repeat(22)}/hire`);
  });
  it("rejects malformed event pairs instead of offering an incorrect calendar event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      reference: "PA-123456", events: [
        { kind: "pickup", date: "2026-11-10", time: "10:00" },
        { kind: "pickup", date: "2026-11-11", time: "18:00" },
      ],
    })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Calendar details could not be loaded");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
  it("explains an unavailable link without exposing internal errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Private diagnostic", { status: 500 })));
    render(<BookingCalendar token={"a".repeat(22)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Calendar details could not be loaded");
    expect(screen.queryByText("Private diagnostic")).not.toBeInTheDocument();
  });
});

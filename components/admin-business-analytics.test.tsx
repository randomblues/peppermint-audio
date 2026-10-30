import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBusinessAnalytics } from "./admin-business-analytics";

const bookings = [
  { id: "past", first_name: "Private", last_name: "Customer", email: "private@example.invalid", status: "completed", event_type: "Wedding", pickup_date: "2026-09-15", dropoff_date: "2026-09-16", created_at: "2026-09-01T00:00:00Z", hire_amount_cents: 10000 },
  { id: "current", first_name: "Private", last_name: "Customer", email: "private@example.invalid", status: "completed", event_type: "Party", pickup_date: "2026-10-10", dropoff_date: "2026-10-11", created_at: "2026-10-01T00:00:00Z", hire_amount_cents: 30000,
    hire_line_items: [{ id: "package:saved", kind: "package", name: "Saved party package", quantity: 1, unitPriceCents: 30000 }] },
  { id: "pending", first_name: "Pending", last_name: "Contact", status: "submitted", event_type: "Party", pickup_date: "2026-10-10", created_at: "2026-10-02T00:00:00Z", hire_amount_cents: 50000 },
];
const props = { bookings, loading: false, error: "", onRetry: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("business performance dashboard", () => {
  it("starts with business questions and period controls, not booking-management filters", () => {
    render(<AdminBusinessAnalytics {...props} />);
    expect(screen.getByRole("heading", { name: "Business performance" })).toBeVisible();
    expect(screen.getByLabelText("Reporting period")).toHaveValue("12-months");
    expect(screen.queryByLabelText("Search bookings")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Private Customer")).not.toBeInTheDocument();
    expect(screen.queryByText("private@example.invalid")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Booking list" })).not.toBeInTheDocument();
  });
  it("compares completed hire performance, excluding pending hire values", () => {
    render(<AdminBusinessAnalytics {...props} />);
    fireEvent.change(screen.getByLabelText("Reporting period"), { target: { value: "30-days" } });
    const sales = screen.getByRole("heading", { name: "Completed hire sales" }).closest<HTMLElement>("[data-slot=card]")!;
    expect(within(sales).getByText("$300.00")).toBeVisible();
    expect(within(sales).getByText("+200%")).toBeVisible();
    expect(screen.getByText("Saved party package")).toBeVisible();
    expect(screen.queryByText("$500.00")).not.toBeInTheDocument();
  });
  it("switches chart questions and opens aggregate trend data", () => {
    render(<AdminBusinessAnalytics {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Requests" }));
    expect(screen.getByRole("img", { name: /Requests received trend/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View trend data" }));
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Completed hires" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide trend data" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("supports custom historical periods and rejects inverted or future dates", () => {
    render(<AdminBusinessAnalytics {...props} />);
    fireEvent.change(screen.getByLabelText("Reporting period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Performance from date"), { target: { value: "2026-11-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("end date");
    expect(screen.getByRole("button", { name: "Export report" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Performance from date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Performance to date"), { target: { value: "2026-11-02" } });
    expect(screen.getByRole("alert")).toHaveTextContent("future");
    fireEvent.change(screen.getByLabelText("Reporting period"), { target: { value: "30-days" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows truthful empty and missing-price states rather than fabricated revenue", () => {
    const { rerender } = render(<AdminBusinessAnalytics {...props} bookings={[]} />);
    expect(screen.getByText(/No completed hires in this period yet/)).toBeVisible();
    rerender(<AdminBusinessAnalytics {...props} bookings={[{ ...bookings[1], hire_amount_cents: null, hire_line_items: [] }]} />);
    expect(screen.getByRole("status")).toHaveTextContent("no recorded price");
    const sales = screen.getByRole("heading", { name: "Completed hire sales" }).closest<HTMLElement>("[data-slot=card]")!;
    expect(within(sales).getByText("Not priced")).toBeVisible();
    expect(within(sales).getByText("Pricing incomplete")).toBeVisible();
    expect(screen.queryByText("$0.01 max")).not.toBeInTheDocument();
  });
  it("surfaces report failures and data calculation errors explicitly", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<AdminBusinessAnalytics {...props} error="Database unavailable" />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Completed hire sales" })).not.toBeInTheDocument();
    rerender(<AdminBusinessAnalytics {...props} bookings={[{ ...bookings[1], hire_line_items: "invalid" }]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("saved booking data");
    expect(log).toHaveBeenCalled();
  });
  it("exports an aggregate performance report", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const create = vi.fn().mockReturnValue("blob:report");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    render(<AdminBusinessAnalytics {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Export report" }));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
  });
});

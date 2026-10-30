import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBookingsWorkspace } from "./admin-bookings-workspace";

const records = [
  { id: "a", first_name: "Alex", last_name: "Active", email: "alex@example.invalid", status: "submitted", event_type: "Wedding", pickup_date: "2026-10-10", hire_amount_cents: 10000 },
  { id: "b", first_name: "Chris", last_name: "Complete", status: "completed", event_type: "Party", pickup_date: "2026-11-10", hire_amount_cents: 20000, hire_payment_status: "paid" },
  { id: "c", first_name: "Cameron", last_name: "Cancelled", status: "cancelled", event_type: "Party", pickup_date: "2026-10-20", hire_amount_cents: 30000 },
];
const props = { bookings: records, loading: false, error: "", onRetry: vi.fn(), onSelect: vi.fn() };
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("booking workspace", () => {
  it("labels hire dates and shows the Melbourne submission date immediately afterwards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
    render(<AdminBookingsWorkspace {...props} bookings={[{
      ...records[0], dropoff_date: "2026-10-12", created_at: "2026-09-30T14:30:00Z",
    }]} />);
    const row = screen.getByRole("button", { name: /Alex Active/ });
    const hireDates = within(row).getByText("Hire Dates: 10 Oct 2026 – 12 Oct 2026");
    const submitted = within(row).getByText("Submitted On: 1 Oct 2026");
    expect(hireDates.nextElementSibling).toBe(submitted);
  });
  it.each([
    ["2026-10-29T13:05:00Z", "2026-10-29T13:01:00Z", "Today"],
    ["2026-10-29T13:05:00Z", "2026-10-29T12:59:00Z", "Yesterday"],
    ["2027-01-01T00:00:00Z", "2026-12-30T13:00:00Z", "Yesterday"],
    ["2027-01-01T00:00:00Z", "2026-12-29T13:00:00Z", "30 Dec 2026"],
    ["2026-10-04T13:05:00Z", "2026-10-03T14:30:00Z", "Yesterday"],
    ["2026-04-05T13:55:00Z", "2026-04-03T14:00:00Z", "Yesterday"],
  ])("formats submission %s / %s as %s using Melbourne calendar days", (now, created, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    render(<AdminBookingsWorkspace {...props} bookings={[{ ...records[0], created_at: created }]} />);
    expect(screen.getByText(`Submitted On: ${expected}`)).toBeVisible();
  });
  it("shows missing submission metadata without inventing a date", () => {
    render(<AdminBookingsWorkspace {...props} bookings={[records[0]]} />);
    expect(screen.getByText("Hire Dates: 10 Oct 2026")).toBeVisible();
    expect(screen.getByText("Submitted On: Not recorded")).toBeVisible();
  });
  it("defaults to newest submissions, changes sorting, and resets to newest first", () => {
    const bookings = [
      { ...records[0], id: "old", first_name: "Old", created_at: "2026-10-01T01:00:00Z", pickup_date: "2026-11-01" },
      { ...records[0], id: "new", first_name: "New", created_at: "2026-10-01T04:00:00Z", pickup_date: "2026-09-01" },
      { ...records[0], id: "missing", first_name: "Missing" },
    ];
    render(<AdminBookingsWorkspace {...props} bookings={bookings} />);
    const names = () => screen.getAllByRole("button", { name: /(?:Old|New|Missing) Active/ }).map((button) => within(button).getByText(/^(Old|New|Missing) Active$/).textContent);
    const sort = screen.getByLabelText("Sort bookings by");
    expect(sort).toHaveValue("submitted");
    const list = screen.getByRole("heading", { name: "Booking list" }).closest<HTMLElement>("[data-slot=card]")!;
    expect(within(list).getByRole("group", { name: "Booking sort" })).toContainElement(sort);
    expect(screen.getByRole("heading", { name: "Explore your bookings" }).closest("[data-slot=card]")).not.toContainElement(sort);
    expect(screen.getByRole("button", { name: "Sort ascending" })).toBeVisible();
    expect(names()).toEqual(["New Active", "Old Active", "Missing Active"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    expect(names()).toEqual(["Old Active", "New Active", "Missing Active"]);
    expect(screen.getByRole("button", { name: "Sort descending" })).toBeVisible();
    fireEvent.change(sort, { target: { value: "pickup" } });
    expect(names()).toEqual(["New Active", "Missing Active", "Old Active"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(names()).toEqual(["Old Active", "Missing Active", "New Active"]);
    expect(screen.getByRole("button", { name: "Sort ascending" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(sort).toHaveValue("submitted");
    expect(screen.getByRole("button", { name: "Sort ascending" })).toBeVisible();
    expect(names()).toEqual(["New Active", "Old Active", "Missing Active"]);
  });
  it("selects only submitted and confirmed by default and uses one set of status controls", () => {
    render(<AdminBookingsWorkspace {...props} />);
    expect(screen.getByText("Alex Active")).toBeVisible();
    expect(screen.queryByText("Chris Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Cameron Cancelled")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Submitted" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Confirmed" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cancelled" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /Hide/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    expect(screen.getByText("Chris Complete")).toBeVisible();
    expect(screen.queryByText("Cameron Cancelled")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Cancelled" }));
    expect(screen.getByText("Cameron Cancelled")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    expect(screen.queryByText("Chris Complete")).not.toBeInTheDocument();
    expect(screen.getByText("Cameron Cancelled")).toBeVisible();
    expect(screen.getByLabelText("Date basis")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Hire value" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("checkbox", { name: "Submitted" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Confirmed" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cancelled" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    expect(screen.queryByText("Cameron Cancelled")).not.toBeInTheDocument();
  });
  it("opens the selected booking from the simple booking list", () => {
    const onSelect = vi.fn();
    render(<AdminBookingsWorkspace {...props} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    fireEvent.click(screen.getByRole("button", { name: /Chris Complete/ }));
    expect(onSelect).toHaveBeenCalledWith(records[1]);
  });
  it("paginates the booking list and resets the page after searching", () => {
    const bookings = Array.from({ length: 21 }, (_, index) => ({ ...records[0], id: String(index), first_name: `Customer ${index}` }));
    render(<AdminBookingsWorkspace {...props} bookings={bookings} />);
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next bookings page" }));
    expect(screen.getByText("Page 2 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next bookings page" }));
    fireEvent.change(screen.getByLabelText("Sort bookings by"), { target: { value: "pickup" } });
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next bookings page" }));
    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "Customer 20" } });
    expect(screen.queryByRole("navigation", { name: "Booking pages" })).not.toBeInTheDocument();
    expect(screen.getByText("Customer 20 Active")).toBeVisible();
  });
  it("offers a retry when bookings cannot be loaded", () => {
    render(<AdminBookingsWorkspace {...props} error="Database unavailable" />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(props.onRetry).toHaveBeenCalled();
  });
  it("exports the selected bookings", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const create = vi.fn().mockReturnValue("blob:test");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    render(<AdminBookingsWorkspace {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Export filtered CSV" }));
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
  });
  it("keeps all screenshot filters on Bookings and combines them with the selected statuses", () => {
    render(<AdminBookingsWorkspace {...props} />);
    expect(screen.getByLabelText("Date range preset")).toBeVisible();
    expect(screen.getByLabelText("Date basis")).toBeVisible();
    expect(screen.getByLabelText("Hire payment filter")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("Hire payment filter"), { target: { value: "paid" } });
    expect(screen.queryByText("Chris Complete")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    expect(screen.getByText("Chris Complete")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Bookings from date"), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText("Bookings to date"), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "Chris Complete" } });
    expect(screen.getByText("Chris Complete")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    expect(screen.queryByText("Chris Complete")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("Chris Complete")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Bookings from date"), { target: { value: "2026-12-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("end date");
    expect(screen.getByRole("button", { name: "Export filtered CSV" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByLabelText("Search bookings")).toHaveValue("");
    expect(screen.getByLabelText("Bookings from date")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Submitted" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Confirmed" })).toBeChecked();
    expect(screen.getByText("Alex Active")).toBeVisible();
  });
});

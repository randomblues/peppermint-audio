import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminConsole } from "./admin-console";

const booking = {
  id: "one",
  first_name: "Alex",
  last_name: "Smith",
  email: "alex@example.com",
  event_type: "Party",
  pickup_date: "2026-10-01",
  dropoff_date: "2026-10-02",
  pickup_time: "10:00",
  dropoff_time: "16:00",
  package_interest: "essential",
  add_ons: ["Wireless microphone"],
  additional_details: "Please call on arrival.",
  status: "submitted",
  internal_notes: "Call about access",
  photo_id_paths: ["private/alex-id.jpg"],
  email_logs: [{
    id: "email-one",
    recipient_email: "alex@example.com",
    email_type: "confirmation",
    sent_at: "2026-10-03T00:00:00.000Z",
  }],
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  window.history.replaceState(null, "", "#bookings");
  await new Promise((resolve) => setTimeout(resolve, 10));
});

describe("AdminConsole", () => {
  it("loads bookings and shows the loading state", async () => {
    let resolve!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((resolvePromise) => { resolve = resolvePromise; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);

    expect(screen.getByText("Loading bookings…")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    resolve(jsonResponse({ bookings: [booking] }));
    expect(await screen.findByText("Alex Smith")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings?", { cache: "no-store" });
  });

  it("sends search and status filters and updates the visible list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [booking] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");

    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "Alex" } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/bookings?search=Alex", { cache: "no-store" }));
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "confirmed" } });
    await waitFor(() => expect(screen.getByText("No bookings match these filters")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/bookings?search=Alex&status=confirmed", { cache: "no-store" });
  });

  it("searches email history by booking and opens the selected booking history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [booking] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");

    fireEvent.click(screen.getByRole("link", { name: "Email history" }));
    expect(await screen.findByRole("heading", { name: "Email history" })).toBeInTheDocument();
    expect(screen.getByText("1 email")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search email history"), { target: { value: "Alex" } });
    expect(screen.getByText("Alex Smith")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alex Smith alex@example.com/ }));
    const historyDialog = screen.getByRole("dialog", { name: "Alex Smith" });
    expect(historyDialog).toBeInTheDocument();
    expect(historyDialog).toHaveTextContent("Booking confirmation");
  });

  it("updates status and notes, sends a reminder, and opens photo links", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ bookings: [booking] }))
      .mockResolvedValue(jsonResponse({ url: "https://signed.example/id.jpg" }));
    vi.stubGlobal("fetch", fetchMock);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    expect(screen.queryByText("Customer email delivery records are kept for 30 days.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Email" })).toBeInTheDocument();
    expect(screen.queryByText("Actions & outcomes")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal email")).not.toBeInTheDocument();
    expect(screen.queryByText("Google Calendar")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ id: "one", status: "confirmed" }),
    })));
    fireEvent.change(screen.getByPlaceholderText("Add a private note for the team…"), { target: { value: "Ready for pickup" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ id: "one", internal_notes: "Ready for pickup" }),
    })));
    fireEvent.click(screen.getByRole("button", { name: "Send Email" }));
    expect(screen.getByRole("heading", { name: "Compose email" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send booking confirmation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send pickup reminder" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Booking confirmation" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pickup reminder" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Load an email template"), { target: { value: "booking-confirmation" } });
    expect(screen.getByLabelText("Email subject")).toHaveValue("Your booking with Peppermint Audio has been confirmed.");
    expect((screen.getByLabelText("Email message") as HTMLTextAreaElement).value).toContain("Your booking with Peppermint Audio has been confirmed.");
    fireEvent.change(screen.getByLabelText("Load an email template"), { target: { value: "pickup-reminder" } });
    expect((screen.getByLabelText("Email subject") as HTMLInputElement).value).toContain("Pickup reminder for");
    expect((screen.getByLabelText("Email message") as HTMLTextAreaElement).value).toContain("181 Nicholson St, Abbotsford VIC 3067");
    expect((screen.getByLabelText("Email message") as HTMLTextAreaElement).value).toContain("Wireless microphone");
    fireEvent.click(screen.getByRole("button", { name: "View private ID" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/photo-link?path=private%2Falex-id.jpg"));
    expect(open).toHaveBeenCalledWith("https://signed.example/id.jpg", "_blank", "noopener,noreferrer");
  });

  it("exports an archive after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["zip"]) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:archive"),
      revokeObjectURL: vi.fn(),
    });

    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByRole("link", { name: "Archive export" }));
    fireEvent.change(screen.getByLabelText("Archive from date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Archive to date"), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Export ZIP" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/export", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ from: "2026-10-01", to: "2026-10-31", confirm: true }),
    })));
    expect(click).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Archive downloaded.");
  });

  it("sends an email with an optional attachment", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ bookings: [booking] }))
      .mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.click(screen.getByRole("button", { name: "Send Email" }));
    fireEvent.change(screen.getByLabelText("Load an email template"), { target: { value: "invoice" } });
    expect(screen.getByLabelText("Email subject")).toHaveValue("Your Peppermint Audio invoice");
    fireEvent.change(screen.getByLabelText("Email subject"), { target: { value: "Invoice for your event" } });
    fireEvent.change(screen.getByLabelText("Email message"), { target: { value: "Hello, your invoice is attached." } });
    const file = new File(["invoice"], "invoice.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Email attachment"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/send-custom-email", expect.objectContaining({ method: "POST", body: expect.any(FormData) })));
    const body = fetchMock.mock.calls.at(-1)?.[1]?.body as FormData;
    expect(body.get("subject")).toBe("Invoice for your event");
    expect(body.get("message")).toBe("Hello, your invoice is attached.");
    expect(body.get("attachment")).toBe(file);
  });

  it("requires delete confirmation and deletes a booking when confirmed", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "GET" || !init?.method ? jsonResponse({ bookings: [booking] }) : jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<AdminConsole />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete booking" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({ method: "DELETE" }));
    fireEvent.click(screen.getByRole("button", { name: "Permanently delete booking" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      method: "DELETE", body: JSON.stringify({ id: "one", confirm: true }),
    })));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("status")).toHaveTextContent("Booking deleted.");
  });

  it("navigates archive and back, signs out, and exposes load errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    await screen.findByText("No bookings match these filters");
    fireEvent.click(screen.getByRole("link", { name: "Archive export" }));
    expect(screen.getByRole("heading", { name: "Archive export" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Back to bookings" }));
    expect(screen.getByRole("heading", { name: "Bookings overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" }));
  });

  it("combines full-time salary with business profit in the tax estimate", async () => {
    const fetchMock = vi.fn().mockImplementation((request: RequestInfo | URL) => {
      return typeof request === "string" && request.startsWith("/api/admin/tax-report")
        ? jsonResponse({ summary: { invoiceCount: 0, taxableSalesCents: 0, gstIncludedCents: 0, securityDepositCents: 0, totalAmountCents: 0 }, rows: [] })
        : jsonResponse({ bookings: [booking] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");
    fireEvent.click(screen.getByRole("link", { name: "Tax" }));
    expect(await screen.findByRole("heading", { name: "Tax" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Tax" }));
    fireEvent.change(screen.getByLabelText("Gross full-time salary and wages"), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText("Business income"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("Deductible business expenses"), { target: { value: "2000" } });
    expect(screen.getByText("$58,000.00")).toBeInTheDocument();
    expect(screen.getByText("$7,920.00")).toBeInTheDocument();
  });

  it("shows the API error and retry action when loading fails", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ error: "Database unavailable" }, false));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

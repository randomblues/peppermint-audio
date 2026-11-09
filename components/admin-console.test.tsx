import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminConsole } from "./admin-console";
import { catalogLineItemFromKey } from "@/lib/booking-line-items";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

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
  additional_details: "Please call on arrival.",
  hire_line_items: [{
    id: "equipment:wireless-microphone",
    kind: "custom",
    name: "Wireless microphone",
    quantity: 1,
    unitPriceCents: 2500,
  }],
  status: "submitted",
  internal_notes: "Call about access",
  photo_id_paths: ["private/alex-id.jpg", "private/alex-id-back.jpg"],
  email_logs: [{
    id: "email-one",
    recipient_email: "alex@example.com",
    email_type: "confirmation",
    provider_message_id: "provider-one",
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
  replace.mockReset();
  window.history.replaceState(null, "", "#bookings");
  await new Promise((resolve) => setTimeout(resolve, 10));
});

describe("AdminConsole", () => {
  it("interleaves outgoing SMS with emails, showing content and accurate provider outcomes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [{
      ...booking,
      sms_logs: [
        { id: "sms-accepted", sms_type: "confirmation", recipient_mobile: "+61400000000",
          body: "Confirmed <script>not executable</script>", status: "accepted", provider_message_id: "sms-provider-1",
          error: null, recorded_at: "2026-10-04T00:00:00Z" },
        { id: "sms-failed", sms_type: "deposit_attention", recipient_mobile: "+61400000000",
          body: "Please check your email before pickup.", status: "failed", provider_message_id: null,
          error: "SMS provider rejected the request (503).", recorded_at: "2026-10-02T00:00:00Z" },
        { id: "sms-dropoff", sms_type: "dropoff_reminder", recipient_mobile: "+61400000000",
          body: "Your equipment drop-off is today at 6:00 PM.", status: "accepted", provider_message_id: "sms-dropoff-1",
          error: null, recorded_at: "2026-10-01T00:00:00Z" },
      ],
    }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.click(screen.getByRole("button", { name: /Communications/ }));
    const history = screen.getByRole("list", { name: "Communication history" });
    const entries = within(history).getAllByRole("listitem");
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent("SMS · Accepted by provider");
    expect(entries[0]).toHaveTextContent("+61400000000");
    expect(entries[0]).toHaveTextContent("Confirmed <script>not executable</script>");
    expect(entries[0].querySelector("script")).toBeNull();
    expect(entries[1]).toHaveTextContent("View sent email");
    expect(entries[2]).toHaveTextContent("Security deposit alert");
    expect(entries[2]).toHaveTextContent("SMS · Failed");
    expect(entries[2]).toHaveTextContent("SMS provider rejected the request (503).");
    expect(entries[3]).toHaveTextContent("Drop-off reminder");
    expect(within(history).getByRole("article", { name: "Drop-off reminder SMS" })).toHaveTextContent("6:00 PM");
    expect(screen.getByText(/SMS acceptance is not delivery confirmation/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks for payment receipt before confirming a bank transfer and allows cancelling", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ bookings: [{
      ...booking, payment_method: "bank_transfer", hire_payment_status: "bank_transfer_pending",
    }] })).mockResolvedValue(jsonResponse({ ok: true, payment: { hire_payment_status: "bank_transfer_received", deposit_payment_status: "bank_transfer_received" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    expect(screen.getByRole("dialog", { name: "Has payment been received?" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "No, not yet" }));
    expect(screen.getByLabelText("Update booking status")).toHaveValue("submitted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Yes, confirm booking" }));
    await waitFor(() => expect(screen.getByLabelText("Update booking status")).toHaveValue("confirmed"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      body: JSON.stringify({ id: "one", status: "confirmed", payment_received: true }),
    }));
    expect(screen.queryByRole("dialog", { name: "Has payment been received?" })).not.toBeInTheDocument();
  });

  it("asks how to record payment when Standard is paid by bank transfer", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ bookings: [{
        ...booking,
        payment_method: "stripe_card_hold",
        bank_transfer_option: "both",
        hire_payment_status: "pending",
        deposit_payment_status: "scheduled",
      }] }))
      .mockResolvedValue(jsonResponse({ ok: true, payment: {
        payment_method: "bank_transfer",
        bank_transfer_option: "both",
        hire_payment_status: "bank_transfer_received",
        deposit_payment_status: "bank_transfer_received",
      } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));

    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    expect(screen.getByRole("dialog", { name: "Has payment been received?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, confirm booking" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      body: JSON.stringify({ id: "one", status: "confirmed", payment_received: true }),
    })));
    await waitFor(() => expect(screen.getByLabelText("Update booking status")).toHaveValue("confirmed"));
    expect(screen.queryByRole("dialog", { name: "Has payment been received?" })).not.toBeInTheDocument();
  });

  it.each([
    { payment_method: "stripe_card_hold", hire_payment_status: "paid" },
    { payment_method: "bank_transfer", hire_payment_status: "bank_transfer_received" },
    { payment_method: "cash_on_pickup", hire_payment_status: "cash_due" },
  ])("confirms without asking for payment when already settled or cash is due: %j", async (payment) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ bookings: [{ ...booking, ...payment }] }))
      .mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    await waitFor(() => expect(screen.getByLabelText("Update booking status")).toHaveValue("confirmed"));
    expect(screen.queryByRole("dialog", { name: "Has payment been received?" })).not.toBeInTheDocument();
  });

  it("reflects a saved confirmation even when its email fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ bookings: [{
      ...booking, payment_method: "bank_transfer", hire_payment_status: "bank_transfer_pending",
    }] })).mockResolvedValue(jsonResponse({
      error: "Booking confirmed, but the confirmation email failed.",
      booking: { status: "confirmed", hire_payment_status: "bank_transfer_received" },
    }, false));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: "Yes, confirm booking" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Booking confirmed, but the confirmation email failed.");
    expect(screen.queryByRole("dialog", { name: "Has payment been received?" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Update booking status")).toHaveValue("confirmed");
  });

  it("shows full multi-night catalogue totals in saved hire details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ bookings: [{
      ...booking, dropoff_date: "2026-10-04",
      hire_line_items: [catalogLineItemFromKey("equipment:bose-s1-pro:Single speaker")],
    }] })));
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    expect(screen.getByLabelText("Hire items total")).toHaveTextContent("$110.00");
    expect(screen.getByText(/Current items saved to this booking.*3 nights/)).toBeInTheDocument();
    expect(screen.getByText("$55.00 each / night")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Increase .* quantity/ })).toBeEnabled();
  });

  it("loads bookings and shows the loading state", async () => {
    let resolve!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((resolvePromise) => { resolve = resolvePromise; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);

    expect(screen.getByText("Loading bookings…")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    resolve(jsonResponse({ bookings: [booking] }));
    expect(await screen.findByText("Alex Smith")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Peppermint Audio home" })).toHaveAttribute("href", "/");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings?all=true", { cache: "no-store" });
  });

  it("applies search and status filters locally without narrowing the shared data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [booking] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");

    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Search bookings"), { target: { value: "No matching customer" } });
    expect(screen.getByText("No bookings match these filters")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes additional selected statuses in Bookings and keeps Analytics defaults separate", async () => {
    const completedBooking = { ...booking, id: "completed", first_name: "Jamie", last_name: "Jones", status: "completed" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ bookings: [booking, completedBooking, { ...booking, id: "cancelled", first_name: "Casey", status: "cancelled" }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);

    expect(await screen.findByText("Alex Smith")).toBeInTheDocument();
    expect(screen.queryByText("Jamie Jones")).not.toBeInTheDocument();
    expect(screen.queryByText("Casey Smith")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cancelled" }));
    expect(screen.getByText("Jamie Jones")).toBeInTheDocument();
    expect(screen.getByText("Casey Smith")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Analytics" }));
    expect(screen.getByRole("heading", { name: "Business performance" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reporting period")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Booking list" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Bookings" }));
    expect(screen.getByRole("checkbox", { name: "Cancelled" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Submitted" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Confirmed" })).toBeChecked();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows communications inside booking details and opens the selected email", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/admin/email-history")) {
        return Promise.resolve(jsonResponse({ email: {
        id: "provider-one",
        subject: "Your booking is confirmed",
        from: "Peppermint Audio <hello@example.com>",
        to: ["alex@example.com"],
        created_at: "2026-10-03T00:00:00.000Z",
        html: "<h1>Your booking is confirmed</h1>",
        text: "Your booking is confirmed",
        attachments: [{
          filename: "invoice.pdf",
          content_type: "application/pdf",
          size: 512,
          url: "/api/admin/email-history/attachment?id=email-one&index=0",
        }],
        attachmentsArchived: true,
        } }));
      }
      return Promise.resolve(jsonResponse({ bookings: [booking] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");

    fireEvent.click(screen.getByRole("button", { name: /Alex Smith alex@example.com/ }));
    const bookingDialog = screen.getByRole("dialog", { name: "Alex Smith" });
    const communications = within(bookingDialog).getByRole("button", { name: /Communications/ });
    expect(communications).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Email history" })).not.toBeInTheDocument();

    fireEvent.click(communications);
    expect(communications).toHaveAttribute("aria-expanded", "true");
    expect(within(bookingDialog).getByRole("heading", { name: "Communication history" })).toBeInTheDocument();
    expect(within(bookingDialog).getByRole("button", { name: "Send Email" })).toBeInTheDocument();
    fireEvent.click(within(bookingDialog).getByRole("button", { name: "Send Email" }));
    expect(screen.getByRole("dialog", { name: "Send an email" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close email dialog" }));
    fireEvent.click(within(bookingDialog).getByRole("button", { name: "View Booking confirmation sent email" }));
    expect(await screen.findByText("Your booking is confirmed")).toBeInTheDocument();
    expect(screen.getByTitle("Rendered Booking confirmation email")).toHaveAttribute("srcdoc", "<h1>Your booking is confirmed</h1>");
    expect(await screen.findByLabelText("invoice.pdf, page 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/admin/email-history/attachment?id=email-one&index=0");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/email-history?id=email-one");
    fireEvent.click(within(bookingDialog).getByRole("button", { name: "Back to communication history" }));
    expect(within(bookingDialog).getByRole("heading", { name: "Communication history" })).toBeInTheDocument();
  });

  it("updates status and notes, sends a reminder, and opens photo links", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ bookings: [booking] }))
      .mockResolvedValue(jsonResponse({ url: "https://signed.example/id.jpg" }));
    vi.stubGlobal("fetch", fetchMock);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));
    const bookingDialog = screen.getByRole("dialog", { name: "Alex Smith" });
    expect(bookingDialog).toHaveClass("sm:max-w-3xl", "rounded-2xl");
    expect(document.querySelector(".backdrop-blur-md")).toBeInTheDocument();
    expect(screen.getAllByText("Booking reference: PA-ONE").length).toBeGreaterThan(0);
    expect(screen.getByText("PA-ONE")).toBeInTheDocument();
    expect(within(bookingDialog).getByText("Event type")).toBeInTheDocument();
    expect(within(bookingDialog).getByText("Party", { exact: true })).toBeInTheDocument();
    expect(within(bookingDialog).getByText("1 Oct 2026").closest("span.inline-flex")).toHaveClass("rounded-lg", "border-white/10", "bg-white/[0.035]");
    expect(within(bookingDialog).getByText("Booking reference: PA-ONE").closest("p")).toHaveClass("text-[11px]", "bg-background/35");
    expect(screen.getByLabelText("Update booking status")).toHaveClass("appearance-none", "max-w-48", "pr-9");
    expect(screen.getByLabelText("Update booking status").parentElement).toHaveClass("relative", "max-w-48");
    const detailGrid = screen.getByText("Customer").closest(".grid");
    const statusControl = screen.getByLabelText("Update booking status");
    expect(statusControl.closest(".grid")).toBe(detailGrid);
    const statusControlItem = statusControl.closest("label")!;
    expect(statusControlItem).toHaveClass("sm:col-start-1", "sm:row-start-5");
    expect(statusControlItem).not.toHaveClass("sm:col-span-2");
    const additionalDetailsLabel = screen.getByText("Additional details", { exact: true });
    expect(statusControlItem.compareDocumentPosition(additionalDetailsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(additionalDetailsLabel.parentElement).toHaveClass("sm:col-start-2", "sm:row-start-5");
    expect(additionalDetailsLabel).toHaveClass("text-xs", "text-muted-foreground");
    expect(screen.getByText("Photo ID", { exact: true })).toHaveClass("text-xs", "text-muted-foreground");
    const statusBadge = within(bookingDialog).getByRole("status", { name: "Booking status: Submitted" });
    expect(statusBadge).toHaveTextContent("Submitted");
    expect(statusBadge).toHaveClass("h-8", "rounded-full", "px-3", "text-sm", "tracking-wide", "ring-white/10", "backdrop-blur-md", "border-amber-300/35", "bg-gradient-to-b", "text-amber-200");
    expect(statusBadge.querySelector("span[aria-hidden='true']")).toHaveClass("size-1.5", "rounded-full", "bg-current", "ring-current/20");
    const bookingTitle = within(bookingDialog).getByRole("heading", { level: 2, name: "Alex Smith" });
    expect(bookingTitle.parentElement).toHaveClass("flex-col", "sm:flex-row");
    expect(bookingTitle).toHaveClass("w-full", "sm:w-auto");
    expect(within(bookingDialog).queryByText("Workflow state")).not.toBeInTheDocument();
    expect(screen.getByText("Customer").closest(".grid")).toHaveClass("sm:grid-cols-2");
    const photoIdActions = screen.getByText("Photo ID", { exact: true }).nextElementSibling as HTMLElement;
    expect(photoIdActions).toHaveClass("flex", "flex-wrap", "gap-2");
    const privateIdButtons = within(photoIdActions).getAllByRole("button", { name: "View ID" });
    expect(privateIdButtons).toHaveLength(2);
    for (const button of privateIdButtons) {
      expect(button).toHaveClass("h-6", "px-1", "underline-offset-4");
      expect(button).not.toHaveClass("w-full");
    }
    expect(screen.getAllByRole("heading", { name: "Hire items" })).toHaveLength(1);
    const savedHireItems = screen.getByRole("heading", { name: "Hire items" }).closest("section")!;
    const savedHireItem = within(savedHireItems).getByText("Wireless microphone");
    const savedHireItemsTotal = within(savedHireItems).getByLabelText("Hire items total");
    expect(savedHireItem.compareDocumentPosition(savedHireItemsTotal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const additionalDetails = screen.getByText("Additional details", { exact: true });
    expect(additionalDetails.closest(".grid")).toHaveClass("sm:grid-cols-2");
    expect(screen.getByText("Please call on arrival.")).not.toHaveClass("rounded-lg", "bg-muted", "p-3");
    const internalNotes = screen.getByRole("button", { name: "Edit internal notes" });
    expect(internalNotes).toHaveClass("h-6", "px-0");
    expect(internalNotes).toHaveTextContent("Edit notes");
    expect(internalNotes).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByPlaceholderText("Add a private note for the team…")).not.toBeVisible();
    const paymentCollection = screen.getByRole("button", { name: /^Payment/ });
    expect(paymentCollection).toHaveAttribute("aria-expanded", "false");
    expect(additionalDetails.compareDocumentPosition(paymentCollection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(internalNotes.compareDocumentPosition(paymentCollection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: /Communications/ }).compareDocumentPosition(paymentCollection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(paymentCollection);
    expect(paymentCollection).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Payment method")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Payment collection" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Hire items" })).toHaveLength(1);
    expect(screen.queryByText("Add-ons")).not.toBeInTheDocument();
    expect(screen.queryByText("Package", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Guests", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Customer email delivery records are kept for 30 days.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Communications/ }));
    expect(screen.getByRole("button", { name: "Send Email" })).toBeInTheDocument();
    expect(screen.queryByText("Actions & outcomes")).not.toBeInTheDocument();
    expect(screen.queryByText("Internal email")).not.toBeInTheDocument();
    expect(screen.queryByText("Google Calendar")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Update booking status"), { target: { value: "confirmed" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ id: "one", status: "confirmed" }),
    })));
    await waitFor(() => expect(within(bookingDialog).getByRole("status", { name: "Booking status: Confirmed" })).toHaveTextContent("Confirmed"));
    fireEvent.click(internalNotes);
    expect(internalNotes).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("Add a private note for the team…")).toHaveValue("Call about access");
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
    fireEvent.click(privateIdButtons[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/photo-link?path=private%2Falex-id.jpg"));
    expect(open).toHaveBeenCalledWith("https://signed.example/id.jpg", "_blank", "noopener,noreferrer");
  });

  it("shows an add-notes option before opening the private notes editor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      bookings: [{ ...booking, internal_notes: "" }],
    })));
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));

    const addNotes = screen.getByRole("button", { name: "Add internal notes" });
    expect(addNotes).toHaveClass("h-6", "px-0");
    expect(addNotes).toHaveTextContent("Add notes");
    expect(addNotes).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByPlaceholderText("Add a private note for the team…")).not.toBeVisible();

    fireEvent.click(addNotes);
    expect(addNotes).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("Add a private note for the team…")).toBeVisible();
  });

  it("uses a compact dash when the customer provided no additional details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      bookings: [{ ...booking, additional_details: "" }],
    })));
    render(<AdminConsole />);
    fireEvent.click(await screen.findByText("Alex Smith"));

    const additionalDetails = screen.getByText("Additional details", { exact: true });
    expect(additionalDetails.nextElementSibling).toHaveTextContent("-");
    expect(additionalDetails.nextElementSibling).not.toHaveClass("rounded-lg", "bg-muted", "p-3");
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
    fireEvent.click(screen.getByRole("button", { name: /Communications/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send Email" }));
    fireEvent.change(screen.getByLabelText("Load an email template"), { target: { value: "invoice" } });
    expect(screen.getByLabelText("Email subject")).toHaveValue("Your Peppermint Audio invoice");
    fireEvent.change(screen.getByLabelText("Email subject"), { target: { value: "Invoice for your event" } });
    fireEvent.change(screen.getByLabelText("Email message"), { target: { value: "Hello, your invoice is attached." } });
    const file = new File(["invoice"], "invoice.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Email attachment"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/send-custom-email", expect.objectContaining({ method: "POST", body: expect.any(FormData) })));
    const sendEmailCall = fetchMock.mock.calls.find(([request]) => request === "/api/admin/send-custom-email");
    const body = sendEmailCall?.[1]?.body as FormData;
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
    expect(screen.getByRole("heading", { name: "Bookings", level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });

  it("redirects to admin login when bookings request is unauthorized", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminConsole />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });

  it("opens the internal inventory workspace from admin navigation", async () => {
    const fetchMock = vi.fn().mockImplementation((request: RequestInfo | URL) => {
      return typeof request === "string" && request === "/api/admin/inventory"
        ? jsonResponse({ products: [], mappings: [], purchases: [], movements: [] })
        : jsonResponse({ bookings: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("No bookings match these filters");
    fireEvent.click(screen.getByRole("link", { name: "Inventory" }));

    expect(await screen.findByRole("heading", { name: "Equipment inventory" })).toBeInTheDocument();
    expect(await screen.findByText(/Inventory details are only available in this admin area/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory", { cache: "no-store" });
  });

  it("combines full-time salary with business profit in the tax estimate", async () => {
    const fetchMock = vi.fn().mockImplementation((request: RequestInfo | URL) => {
      return typeof request === "string" && request.startsWith("/api/admin/tax-report")
        ? jsonResponse({
          summary: { invoiceCount: 0, taxableSalesCents: 0, gstIncludedCents: 0, securityDepositCents: 0, totalAmountCents: 0 },
          rows: [],
          purchaseSummary: { purchaseCount: 0, totalCostCents: 0, gstPaidCents: 0 },
          purchases: [],
        })
        : jsonResponse({ bookings: [booking] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminConsole />);
    await screen.findByText("Alex Smith");
    fireEvent.click(screen.getByRole("link", { name: "Tax" }));
    expect(await screen.findByRole("heading", { name: "Tax" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run report" }).parentElement).toHaveClass(
      "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]",
    );
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

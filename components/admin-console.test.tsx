import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminConsole } from "./admin-console";

describe("AdminConsole", () => {
  it("uses lowercase status values and keeps status selection consistent with the list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bookings: [{
          id: "one", first_name: "Alex", last_name: "Smith", event_type: "Party",
          pickup_date: "2026-10-01", status: "confirmed",
        }, {
          id: "two", first_name: "Sam", last_name: "Jones", event_type: "Wedding",
          pickup_date: "2026-10-02", status: "submitted",
        }],
      }),
    }));
    render(<AdminConsole />);
    await waitFor(() => expect(screen.getByText("Alex Smith")).toBeInTheDocument());

    const status = screen.getByLabelText("Filter by status") as HTMLSelectElement;
    expect(status.options[1].value).toBe("submitted");
    expect(status.options[2].value).toBe("confirmed");
    expect(screen.getByText("Sam Jones")).toBeInTheDocument();
  });

  it("shows the API error and retry action when loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Database unavailable" }),
    }));
    render(<AdminConsole />);
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

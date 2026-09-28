import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminLogin } from "./admin-login";

describe("AdminLogin", () => {
  it("shows the API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid credentials" }),
    }));
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "wrong-password" }),
    }));
  });

  it("redirects after a successful login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/login", expect.objectContaining({
      method: "POST",
    })));
    consoleError.mockRestore();
  });
});

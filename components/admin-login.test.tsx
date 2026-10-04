import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLogin } from "./admin-login";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("AdminLogin", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("includes a hidden page-level heading for accessibility", () => {
    render(<AdminLogin />);

    expect(screen.getByRole("heading", { level: 1, name: "Admin login" })).toHaveClass("sr-only");
  });

  it("shows the API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: "Invalid credentials" }),
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
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/login", expect.objectContaining({
      method: "POST",
    })));
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("shows a useful message when the login response is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "",
    }));
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Login failed.")).toBeInTheDocument();
  });

  it("handles a failed login request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("The admin login service is unavailable.")).toBeInTheDocument();
  });
});

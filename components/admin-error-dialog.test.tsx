import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminErrorDialog } from "./admin-error-dialog";

describe("AdminErrorDialog", () => {
  it("presents an error with a warning treatment and explicit close action", () => {
    const onClose = vi.fn();
    render(<AdminErrorDialog message="Mark the hire payment as paid." onClose={onClose} />);
    expect(screen.getByRole("alertdialog")).toHaveClass("border-destructive/30");
    expect(screen.getByText("Mark the hire payment as paid.")).toBeVisible();
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveClass("text-destructive", "min-h-11");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not display a dialog without an error", () => {
    render(<AdminErrorDialog message="" onClose={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

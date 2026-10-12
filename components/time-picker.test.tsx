import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimePicker } from "./time-picker";

describe("TimePicker", () => {
  it("uses a native dropdown with 30-minute options and a separate AM/PM switch", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker id="pickup-time" label="Pickup time" value="" onChange={onChange} />,
    );

    const select = screen.getByRole("combobox", { name: "Pickup time" });
    expect(select).toHaveValue("");
    expect(select).toHaveDisplayValue("Select time");
    expect(screen.getAllByRole("option")).toHaveLength(25);
    expect(screen.getByRole("option", { name: "12:00" })).toHaveValue("12:00");
    expect(screen.getByRole("option", { name: "11:30" })).toHaveValue("11:30");
    expect(screen.queryByRole("option", { name: "11:45" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pickup time PM" }));
    fireEvent.change(select, { target: { value: "03:00" } });
    expect(onChange).toHaveBeenLastCalledWith("15:00");
    rerender(<TimePicker id="pickup-time" label="Pickup time" value="15:00" onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: "Pickup time" })).toHaveValue("03:00");
    expect(screen.getByRole("button", { name: "Pickup time PM" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Pickup time AM" }));
    expect(onChange).toHaveBeenLastCalledWith("03:00");
  });

  it("opens a compact desktop modal without helper text and applies time selections immediately", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker id="pickup-time" label="Pickup time" value="09:30" onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId("pickup-time-desktop-trigger"));
    const dialog = screen.getByRole("dialog");
    expect(within(screen.getByTestId("pickup-time-time-options")).getAllByRole("button")).toHaveLength(24);
    expect(within(dialog).queryByText("Choose a time in 15-minute steps.")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /save|cancel/i })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Pickup time PM" }));
    expect(onChange).toHaveBeenLastCalledWith("21:30");
    rerender(<TimePicker id="pickup-time" label="Pickup time" value="21:30" onChange={onChange} />);

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pickup time 3:00 PM" }));
    expect(onChange).toHaveBeenLastCalledWith("15:00");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps existing times between half-hour options selectable", () => {
    render(<TimePicker id="pickup-time" label="Pickup time" value="10:07" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Pickup time" });
    expect(select).toHaveValue("10:07");
    expect(select).toHaveDisplayValue("10:07");
    expect(screen.getAllByRole("option")).toHaveLength(26);
  });

  it("applies a period selected before choosing a time", () => {
    const onChange = vi.fn();
    render(<TimePicker id="pickup-time" label="Pickup time" value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pickup time PM" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Pickup time" }), { target: { value: "03:00" } });
    expect(onChange).toHaveBeenLastCalledWith("15:00");
  });

  it("shows validation errors on the dropdown", () => {
    render(<TimePicker id="pickup-time" label="Pickup time" value="" onChange={vi.fn()} error="Enter a pickup time." />);

    expect(screen.getByRole("combobox", { name: "Pickup time" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Pickup time" })).toHaveAttribute("aria-describedby", "pickup-time-error");
    expect(screen.getByText("Enter a pickup time.")).toBeInTheDocument();
  });
});

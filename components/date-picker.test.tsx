import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
  it("opens, changes month, and returns the selected date", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<DatePicker id="event-date" value="2026-10-15" onChange={onChange} onBlur={onBlur} />);

    fireEvent.click(screen.getByRole("button", { name: "15 October 2026" }));
    expect(screen.getByRole("dialog", { name: "Choose event date" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("November 2026")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const dateButton = within(dialog).getAllByRole("button").find((button) => button.getAttribute("aria-pressed") !== null);
    expect(dateButton).toBeDefined();
    fireEvent.click(dateButton!);

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^2026-11-\d{2}$/));
    expect(onBlur).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes and blurs when clicking outside", () => {
    const onBlur = vi.fn();
    render(
      <div>
        <DatePicker id="event-date" value="" onChange={vi.fn()} onBlur={onBlur} />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalled();
  });
});

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

  it("disables dates before the configured minimum", () => {
    render(<DatePicker id="event-date" value="2026-10-15" minDate="2026-10-15" onChange={vi.fn()} onBlur={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "15 October 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

    const dialog = screen.getByRole("dialog", { name: "Choose event date" });
    const dateButtons = within(dialog).getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
    expect(dateButtons.length).toBeGreaterThan(0);
    expect(dateButtons.every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("shows a connected pickup-to-dropoff range when range props are provided", () => {
    render(
      <DatePicker
        id="dropoff-date"
        value="2026-10-18"
        rangeStart="2026-10-15"
        rangeEnd="2026-10-18"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "18 October 2026" }));

    const dialog = screen.getByRole("dialog", { name: "Choose event date" });
    const startCell = within(dialog).getByRole("button", { name: "15/10/2026" }).parentElement;
    const middleCell = within(dialog).getByRole("button", { name: "16/10/2026" }).parentElement;
    const endCell = within(dialog).getByRole("button", { name: "18/10/2026" }).parentElement;

    expect(startCell).toHaveAttribute("data-range-start", "true");
    expect(middleCell).toHaveAttribute("data-range-middle", "true");
    expect(endCell).toHaveAttribute("data-range-end", "true");
  });

  it("previews the range continuously while hovering drop-off dates", () => {
    render(
      <DatePicker
        id="dropoff-date"
        value=""
        rangeStart="2026-10-18"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select a date" }));

    const dialog = screen.getByRole("dialog", { name: "Choose event date" });
    fireEvent.mouseEnter(within(dialog).getByRole("button", { name: "23/10/2026" }));

    const rangeStartCell = within(dialog).getByRole("button", { name: "18/10/2026" }).parentElement;
    const rangeMiddleCell = within(dialog).getByRole("button", { name: "21/10/2026" }).parentElement;
    const rangeEndCell = within(dialog).getByRole("button", { name: "23/10/2026" }).parentElement;

    expect(rangeStartCell).toHaveAttribute("data-range-start", "true");
    expect(rangeMiddleCell).toHaveAttribute("data-range-middle", "true");
    expect(rangeEndCell).toHaveAttribute("data-range-end", "true");
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TimePicker } from "./time-picker";

function ControlledTimePicker({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <TimePicker
      id="pickup-time"
      label="Pickup time"
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
    />
  );
}

describe("TimePicker", () => {
  it("keeps a wide popup inside a narrow viewport", () => {
    const viewport = vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(360);
    render(<ControlledTimePicker onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Pickup time" });
    const bounds = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 64, y: 400, left: 64, right: 296, top: 400, bottom: 448, width: 232, height: 48,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveStyle({ left: "-56px", width: "344px" });
    expect(screen.getByRole("button", { name: "AM" }).parentElement).toHaveClass("col-span-3", "sm:col-span-1");
    bounds.mockRestore();
    viewport.mockRestore();
  });

  it("sets a time with the segmented controls", () => {
    const onChange = vi.fn();
    render(<ControlledTimePicker onChange={onChange} />);

    expect(screen.getByRole("button", { name: /Pickup time/ })).toHaveClass(
      "[@media(pointer:coarse)]:hidden",
    );
    fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Pickup time hour"), { target: { value: "10" } });
    fireEvent.change(within(dialog).getByLabelText("Pickup time minute"), { target: { value: "30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("22:30");
    expect(screen.getByRole("button", { name: /Pickup time/ })).toHaveTextContent("10:30 PM");

  });

  it("reflects controlled changes from the native time input", () => {
    const onChange = vi.fn();
    const view = render(<ControlledTimePicker onChange={onChange} />);

    fireEvent.change(view.container.querySelector('input[type="time"]')!, { target: { value: "14:45" } });
    expect(onChange).toHaveBeenLastCalledWith("14:45");
  });

  it("clears a selected time", () => {
    const onChange = vi.fn();
    render(<TimePicker id="pickup-time" label="Pickup time" value="10:00" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear pickup time" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("commits the default draft when Done is pressed immediately", () => {
    const onChange = vi.fn();
    render(<ControlledTimePicker onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onChange).toHaveBeenLastCalledWith("09:00");
    expect(screen.getByRole("button", { name: /Pickup time/ })).toHaveTextContent("9:00 AM");
  });
});

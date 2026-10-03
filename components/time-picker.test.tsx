import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimePicker } from "./time-picker";

describe("TimePicker", () => {
  it("sets a time with the segmented controls", () => {
    const onChange = vi.fn();
    render(<TimePicker id="pickup-time" label="Pickup time" value="" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /Pickup time/ })).toHaveClass(
      "[@media(pointer:coarse)]:hidden",
    );
    fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Pickup time hour"), { target: { value: "10" } });
    fireEvent.change(within(dialog).getByLabelText("Pickup time minute"), { target: { value: "30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("22:30");

  });

  it("clears a selected time", () => {
    const onChange = vi.fn();
    render(<TimePicker id="pickup-time" label="Pickup time" value="10:00" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Pickup time/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear pickup time" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

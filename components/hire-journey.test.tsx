import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HireJourney } from "./hire-journey";
import { howItWorks } from "@/lib/site-content";

describe("HireJourney", () => {
  let reducedMotion: boolean;
  let queuedFrame: FrameRequestCallback | undefined;
  let preferenceChanged: (() => void) | undefined;
  const removePreferenceListener = vi.fn();

  beforeEach(() => {
    reducedMotion = false;
    queuedFrame = undefined;
    preferenceChanged = undefined;
    removePreferenceListener.mockReset();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      get matches() { return reducedMotion; },
      addEventListener: (_event: string, callback: () => void) => { preferenceChanged = callback; },
      removeEventListener: removePreferenceListener,
    })));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      queuedFrame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, bottom: 900, height: 800, left: 0, right: 390, width: 390,
      x: 0, y: 100, toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps every stage and practical detail visible without waiting for animations", () => {
    render(<HireJourney />);
    for (const stage of howItWorks) {
      expect(screen.getByRole("region", { name: stage.title })).toBeVisible();
      for (const paragraph of stage.detail.split("\n\n")) {
        expect(screen.getByText(paragraph)).toBeVisible();
      }
    }
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    for (const number of ["1", "2", "3"]) {
      expect(screen.getByText(number)).toBeInTheDocument();
    }
    expect(screen.getByText(/with your photo ID/)).toBeVisible();
    expect(screen.getByText(/phone call away if you need a hand/)).toBeVisible();
  });

  it("updates scroll transforms once per frame and stops animation outside the viewport", () => {
    render(<HireJourney />);
    const scene = screen.getByRole("region", { name: howItWorks[0].title });
    expect(scene).toHaveAttribute("data-active", "true");
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      top: 2000, bottom: 2800, height: 800, left: 0, right: 390, width: 390,
      x: 0, y: 2000, toJSON: () => ({}),
    });
    act(() => queuedFrame?.(0));
    expect(scene).toHaveAttribute("data-active", "false");
    expect(scene.style.getPropertyValue("--travel")).toBe("-1");
  });

  it("honours reduced motion initially and when the preference changes", () => {
    reducedMotion = true;
    render(<HireJourney />);
    const scene = screen.getByRole("region", { name: howItWorks[0].title });
    expect(scene).toHaveAttribute("data-active", "false");
    expect(scene.style.getPropertyValue("--travel")).toBe("0");
    reducedMotion = false;
    act(() => { preferenceChanged?.(); queuedFrame?.(0); });
    expect(scene).toHaveAttribute("data-active", "true");
  });

  it("removes listeners and cancels scheduled work on unmount", () => {
    const { unmount } = render(<HireJourney />);
    act(() => window.dispatchEvent(new Event("scroll")));
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(removePreferenceListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

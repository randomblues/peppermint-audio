import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoIdCapture } from "./photo-id-capture";

describe("PhotoIdCapture", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:photo-id-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks the guided camera launcher as phone-only", () => {
    render(<PhotoIdCapture capturedCount={0} onCapture={vi.fn()} />);

    expect(screen.getByTestId("photo-id-camera-launch")).toHaveClass("sm:hidden");
    expect(screen.getByText("Scan your photo ID")).toBeInTheDocument();
    expect(screen.queryByText(/Photos stay on your device/)).not.toBeInTheDocument();
  });

  it("opens a full-screen guide and lets customers review a low-light photo before using it", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(HTMLVideoElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1600);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(900);
    vi.spyOn(HTMLVideoElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 390, 844));
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(160 * 101 * 4),
    } as unknown as ImageData));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      getImageData,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["captured image"], { type: "image/jpeg" }));
    });
    const onCapture = vi.fn();

    render(<PhotoIdCapture capturedCount={0} onCapture={onCapture} />);
    fireEvent.click(screen.getByRole("button", { name: "Scan front of ID" }));

    const dialog = await screen.findByRole("dialog", { name: "Line up your photo ID" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Fit all four corners inside")).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: false,
      video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
    }));

    const preview = await screen.findByLabelText("Live photo ID camera preview");
    const frame = screen.getByText("Fit all four corners inside").parentElement;
    if (!frame) throw new Error("The ID framing guide is missing.");
    vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(new DOMRect(16, 306, 358, 226));
    fireEvent.canPlay(preview);
    fireEvent.click(screen.getByRole("button", { name: "Capture front" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too dark/i);
    const [, cropX, cropY, cropWidth, cropHeight] = drawImage.mock.calls[0];
    expect(cropX).toBeGreaterThan(0);
    expect(cropY).toBeGreaterThan(0);
    expect(cropWidth / cropHeight).toBeCloseTo(1.586, 2);
    expect(screen.getByRole("img", { name: "Captured front of photo ID" })).toHaveAttribute("src", "blob:photo-id-preview");
    expect(screen.queryByRole("button", { name: "Use photo anyway" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake photo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retake photo" }));
    fireEvent.canPlay(await screen.findByLabelText("Live photo ID camera preview"));
    const neutralPixels = new Uint8ClampedArray(160 * 101 * 4);
    for (let index = 0; index < neutralPixels.length; index += 4) {
      neutralPixels[index] = 120;
      neutralPixels[index + 1] = 120;
      neutralPixels[index + 2] = 120;
      neutralPixels[index + 3] = 255;
    }
    getImageData.mockReturnValue({ data: neutralPixels } as unknown as ImageData);
    fireEvent.click(screen.getByRole("button", { name: "Capture front" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/may be blurry/i);
    expect(screen.queryByRole("button", { name: "Use this photo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retake photo" }));
    fireEvent.canPlay(await screen.findByLabelText("Live photo ID camera preview"));

    const detailedPixels = new Uint8ClampedArray(160 * 101 * 4);
    for (let y = 0; y < 101; y += 1) {
      for (let x = 0; x < 160; x += 1) {
        const index = (y * 160 + x) * 4;
        const brightness = (x + y) % 2 === 0 ? 50 : 205;
        detailedPixels[index] = brightness;
        detailedPixels[index + 1] = brightness;
        detailedPixels[index + 2] = brightness;
        detailedPixels[index + 3] = 255;
      }
    }
    getImageData.mockReturnValue({ data: detailedPixels } as unknown as ImageData);
    fireEvent.click(screen.getByRole("button", { name: "Capture front" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Photo looks clear/);
    fireEvent.click(screen.getByRole("button", { name: "Use this photo" }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ name: "photo-id-front.jpg", type: "image/jpeg" }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Close camera" }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it("returns to the existing upload flow when camera permission is blocked", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PhotoIdCapture capturedCount={0} onCapture={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Scan front of ID" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Camera access was blocked/);
    fireEvent.click(screen.getByRole("button", { name: "Back to uploads" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan front of ID" })).toBeInTheDocument();
  });

  it("stops a late camera stream if the customer closes while permission is pending", async () => {
    let provideStream: ((value: MediaStream) => void) | undefined;
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => {
      provideStream = resolve;
    }));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<PhotoIdCapture capturedCount={0} onCapture={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Scan front of ID" }));
    fireEvent.click(await screen.findByRole("button", { name: "Close camera" }));
    provideStream?.(stream);

    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });
});

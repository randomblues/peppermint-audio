"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ScanLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PhotoIdCapture({
  capturedCount,
  onCapture,
}: {
  capturedCount: number;
  onCapture: (file: File) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewUrl, setReviewUrl] = useState("");
  const [qualityTip, setQualityTip] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const cameraRequestId = useRef(0);

  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError("The camera preview could not start. Allow camera access or choose image files instead.");
    });
    return () => {
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!reviewUrl) return;
    return () => URL.revokeObjectURL(reviewUrl);
  }, [reviewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const launchButton = launchButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCamera();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const phoneViewport = window.matchMedia?.("(max-width: 639px)");
    function handleViewportChange() {
      if (phoneViewport && !phoneViewport.matches) closeCamera();
    }
    document.addEventListener("keydown", handleKeyDown);
    phoneViewport?.addEventListener?.("change", handleViewportChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      phoneViewport?.removeEventListener?.("change", handleViewportChange);
      launchButton?.focus();
    };
  }, [isOpen]);

  async function startCamera() {
    const requestId = ++cameraRequestId.current;
    setIsOpen(true);
    setCameraError("");
    setIsStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera capture is not available in this browser. Choose image files instead.");
        return;
      }
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (requestId !== cameraRequestId.current) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }
      setIsReady(false);
      setStream(cameraStream);
    } catch (error) {
      console.error("Photo ID camera access failed:", error);
      if (requestId === cameraRequestId.current) {
        setCameraError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera access was blocked. Allow camera access in your browser settings, or choose image files instead."
            : "We could not start the camera. Choose image files instead.",
        );
      }
    } finally {
      if (requestId === cameraRequestId.current) setIsStarting(false);
    }
  }

  function closeCamera() {
    cameraRequestId.current += 1;
    setIsOpen(false);
    setStream(null);
    setIsReady(false);
    setIsStarting(false);
    setCameraError("");
    setReviewFile(null);
    setReviewUrl("");
    setQualityTip("");
  }

  function getQualityTip(canvas: HTMLCanvasElement): string {
    const sample = document.createElement("canvas");
    sample.width = 160;
    sample.height = 101;
    const context = sample.getContext("2d");
    if (!context) throw new Error("Photo quality analysis is unavailable.");

    const cropWidth = Math.min(canvas.width, canvas.height * 1.586);
    const cropHeight = cropWidth / 1.586;
    context.drawImage(
      canvas,
      (canvas.width - cropWidth) / 2,
      (canvas.height - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      sample.width,
      sample.height,
    );
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const grayscale = new Uint8Array(sample.width * sample.height);
    let brightnessTotal = 0;
    let darkPixelCount = 0;
    let brightPixelCount = 0;
    for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
      const offset = pixel * 4;
      const brightness = Math.round(pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722);
      grayscale[pixel] = brightness;
      brightnessTotal += brightness;
      if (brightness < 45) darkPixelCount += 1;
      if (brightness > 245) brightPixelCount += 1;
    }

    const averageBrightness = brightnessTotal / grayscale.length;
    if (averageBrightness < 75 || darkPixelCount / grayscale.length > 0.45) {
      return "This photo looks too dark. Add more light and try again.";
    }
    if (brightPixelCount / grayscale.length > 0.35) {
      return "Some details may be washed out by glare. Tilt the ID slightly and try again.";
    }

    let laplacianTotal = 0;
    let laplacianSquaredTotal = 0;
    let sampleCount = 0;
    for (let y = 1; y < sample.height - 1; y += 1) {
      for (let x = 1; x < sample.width - 1; x += 1) {
        const index = y * sample.width + x;
        const laplacian = grayscale[index - sample.width]
          + grayscale[index - 1]
          + grayscale[index + 1]
          + grayscale[index + sample.width]
          - 4 * grayscale[index];
        laplacianTotal += laplacian;
        laplacianSquaredTotal += laplacian * laplacian;
        sampleCount += 1;
      }
    }
    const laplacianVariance = laplacianSquaredTotal / sampleCount - (laplacianTotal / sampleCount) ** 2;
    if (laplacianVariance < 18) return "This photo may be blurry. Hold steady and try again.";
    return "";
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Please wait a moment and try again.");
      return;
    }

    setCameraError("");
    setIsCapturing(true);
    try {
      const videoRect = video.getBoundingClientRect();
      const frameRect = frameRef.current?.getBoundingClientRect();
      const coverScale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
      const renderedWidth = video.videoWidth * coverScale;
      const renderedHeight = video.videoHeight * coverScale;
      const fallbackWidth = Math.min(video.videoWidth, video.videoHeight * 1.586);
      const fallbackHeight = fallbackWidth / 1.586;
      const sourceX = frameRect && videoRect.width > 0
        ? (frameRect.left - videoRect.left + (renderedWidth - videoRect.width) / 2) / coverScale
        : (video.videoWidth - fallbackWidth) / 2;
      const sourceY = frameRect && videoRect.height > 0
        ? (frameRect.top - videoRect.top + (renderedHeight - videoRect.height) / 2) / coverScale
        : (video.videoHeight - fallbackHeight) / 2;
      const cropX = Math.max(0, Math.min(video.videoWidth, sourceX));
      const cropY = Math.max(0, Math.min(video.videoHeight, sourceY));
      const cropWidth = Math.max(1, Math.min(video.videoWidth - cropX, frameRect && videoRect.width > 0 ? frameRect.width / coverScale : fallbackWidth));
      const cropHeight = Math.max(1, Math.min(video.videoHeight - cropY, frameRect && videoRect.height > 0 ? frameRect.height / coverScale : fallbackHeight));
      const scale = Math.min(1, 2400 / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo capture is unavailable in this browser.");
      context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

      let nextQualityTip: string;
      try {
        nextQualityTip = getQualityTip(canvas);
      } catch (error) {
        console.error("Photo ID quality check failed:", error);
        nextQualityTip = "We could not check this photo automatically. Please review it closely.";
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("We could not capture that photo. Please try again or choose an image file.");
      const side = capturedCount === 0 ? "front" : "back";
      const file = new File([blob], `photo-id-${side}.jpg`, { type: "image/jpeg" });
      setReviewFile(file);
      setReviewUrl(URL.createObjectURL(blob));
      setQualityTip(nextQualityTip);
      setIsReady(false);
      setStream(null);
    } catch (error) {
      console.error("Photo ID capture failed:", error);
      setCameraError(error instanceof Error ? error.message : "We could not capture that photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }

  function retakePhoto() {
    setReviewFile(null);
    setReviewUrl("");
    setQualityTip("");
    void startCamera();
  }

  function usePhoto() {
    if (!reviewFile || qualityTip) return;
    onCapture(reviewFile);
    setReviewFile(null);
    setReviewUrl("");
    setQualityTip("");
    if (capturedCount === 1) {
      closeCamera();
    } else {
      void startCamera();
    }
  }

  return (
    <div className="space-y-3" data-testid="photo-id-camera">
      <div data-testid="photo-id-camera-launch" className="space-y-3 rounded-xl border bg-muted/30 p-4 sm:hidden">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Scan your photo ID</p>
          <p className="text-sm text-muted-foreground">Use the camera guide to capture the front and back clearly.</p>
        </div>
        <Button
          ref={launchButtonRef}
          type="button"
          onClick={startCamera}
          disabled={isStarting || capturedCount >= 2}
          className="w-full"
        >
          <Camera aria-hidden="true" />
          {isStarting ? "Opening camera..." : capturedCount === 0 ? "Scan front of ID" : capturedCount === 1 ? "Scan back of ID" : "Both sides captured"}
        </Button>
      </div>

      {isOpen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-id-capture-title"
          className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-black text-white"
          data-testid="photo-id-capture-dialog"
        >
          {stream ? (
            <div className={`absolute inset-0 ${reviewFile ? "hidden" : ""}`}>
              <video
                ref={videoRef}
                aria-label="Live photo ID camera preview"
                autoPlay
                muted
                playsInline
                onCanPlay={() => setIsReady(true)}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/80" />
            </div>
          ) : null}

          <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                <span className="grid size-7 place-items-center rounded-lg border border-white/15 bg-white/10">
                  <ScanLine className="size-4 text-primary" aria-hidden="true" />
                </span>
                <span>Photo ID scan</span>
              </div>
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">{capturedCount === 0 ? "Side 1 of 2 · Front" : "Side 2 of 2 · Back"}</p>
              <h2 id="photo-id-capture-title" className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{reviewFile ? "Review your photo" : "Line up your photo ID"}</h2>
              <div className="mt-3 flex max-w-xs gap-1.5" aria-hidden="true">
                <span className="h-1 flex-1 rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_60%,transparent)]" />
                <span className={`h-1 flex-1 rounded-full ${capturedCount > 0 ? "bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_60%,transparent)]" : "bg-white/20"}`} />
              </div>
            </div>
            <Button
              ref={closeButtonRef}
              type="button"
              variant="outline"
              size="icon"
              aria-label="Close camera"
              onClick={closeCamera}
              className="size-10 rounded-full border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md hover:border-white/40 hover:bg-white/10"
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          {reviewFile ? (
            <div className="absolute inset-x-0 bottom-0 top-32 z-10 flex flex-col items-center justify-center gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-5">
              <div className="relative flex max-h-[58dvh] w-full max-w-3xl items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-2 shadow-[0_24px_70px_rgb(0_0_0/0.4)] backdrop-blur-sm">
                {/* Object URLs are already local, compressed files and should not be sent through Next image optimization. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reviewUrl} alt={`Captured ${capturedCount === 0 ? "front" : "back"} of photo ID`} className="max-h-[54dvh] max-w-full rounded-2xl object-contain" />
                <span className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                  <Check className="size-3.5 text-primary" aria-hidden="true" />
                  {capturedCount === 0 ? "Front side preview" : "Back side preview"}
                </span>
              </div>
              {qualityTip ? (
                <p role="alert" className="flex max-w-md items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-950/75 px-4 py-3 text-center text-sm text-amber-50 shadow-lg backdrop-blur-md">
                  <span className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
                  {qualityTip}
                </p>
              ) : (
                <p role="status" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-md">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  Photo looks clear. Check that the details are readable.
                </p>
              )}
              <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={retakePhoto} className="w-full border-white/30 bg-black/40 text-white hover:bg-black/70 sm:flex-1">
                  Retake photo
                </Button>
                {!qualityTip ? (
                  <Button type="button" onClick={usePhoto} className="w-full sm:flex-1">
                    Use this photo
                  </Button>
                ) : null}
              </div>
            </div>
          ) : stream ? (
            <>
              <div className="absolute inset-x-4 top-[18%] bottom-[25%] z-10 flex items-center justify-center">
                <div ref={frameRef} className="relative flex aspect-[1.586/1] w-full max-w-[38rem] items-start justify-center rounded-2xl border border-white/30 bg-white/[0.03] shadow-[0_0_0_999px_rgb(0_0_0/0.48),0_0_40px_rgb(0_0_0/0.25)]">
                  <span className="absolute left-1/2 top-3 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                    <ScanLine className="size-3.5 text-primary" aria-hidden="true" />
                    Fit all four corners inside
                  </span>
                  <span className="pointer-events-none absolute left-[-1px] top-[-1px] size-8 rounded-tl-2xl border-l-[3px] border-t-[3px] border-primary shadow-[-2px_-2px_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
                  <span className="pointer-events-none absolute right-[-1px] top-[-1px] size-8 rounded-tr-2xl border-r-[3px] border-t-[3px] border-primary shadow-[2px_-2px_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
                  <span className="pointer-events-none absolute bottom-[-1px] left-[-1px] size-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-primary shadow-[-2px_2px_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
                  <span className="pointer-events-none absolute bottom-[-1px] right-[-1px] size-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-primary shadow-[2px_2px_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
                  <span className="photo-id-scanline pointer-events-none absolute inset-x-3 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_85%,transparent)]" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:space-y-4">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-2 text-xs text-white/90 shadow-lg backdrop-blur-md">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  Hold steady · avoid glare
                </div>
                {cameraError ? <p role="alert" className="text-sm text-red-200">{cameraError}</p> : null}
                <Button
                  type="button"
                  aria-label={isCapturing ? "Checking captured photo" : capturedCount === 0 ? "Capture front" : "Capture back"}
                  onClick={capturePhoto}
                  disabled={!isReady || isCapturing}
                  className="mx-auto grid size-[4.25rem] place-items-center rounded-full border-4 border-white/80 bg-primary p-1 text-primary-foreground shadow-[0_0_0_6px_rgb(255_255_255/0.15),0_12px_35px_rgb(0_0_0/0.45)] transition-transform hover:scale-105 active:scale-95 disabled:scale-100 sm:size-[4.75rem]"
                  title={isCapturing ? "Checking photo" : capturedCount === 0 ? "Capture front of ID" : "Capture back of ID"}
                >
                  <Camera className="size-7" aria-hidden="true" />
                </Button>
                <p className="text-xs font-medium text-white/70">{isCapturing ? "Checking your photo..." : capturedCount === 0 ? "Tap to capture the front" : "Tap to capture the back"}</p>
              </div>
            </>
          ) : (
            <div className="absolute inset-x-5 top-1/2 z-10 mx-auto w-full max-w-md -translate-y-1/2 rounded-2xl border border-white/20 bg-black/65 p-6 text-center backdrop-blur">
              <p role={cameraError ? "alert" : "status"} className="text-sm text-white/90">
                {cameraError || "Opening your camera..."}
              </p>
              {cameraError ? (
                <Button type="button" variant="outline" onClick={closeCamera} className="mt-5 border-white/30 bg-black/40 text-white hover:bg-black/70">
                  Back to uploads
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PdfAttachmentPreview({ url, filename }: { url: string; filename: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setContainerWidth(container.clientWidth || window.innerWidth);
    const initialMeasure = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(initialMeasure);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerWidth) return;
    let active = true;
    let loadingTask: ReturnType<typeof import("pdfjs-dist/legacy/build/pdf.mjs").getDocument> | null = null;
    let cancelRender: (() => void) | null = null;

    async function renderPage() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        pdfjs.GlobalWorkerOptions.rendererSrc = new URL("pdfjs-dist/legacy/build/pdf.renderer.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url, withCredentials: true, disableWorkerRendering: true });
        loadingTask = task;
        const document = await task.promise;
        if (!active) return;
        setPageCount(document.numPages);
        const page = await document.getPage(pageNumber);
        if (!active) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1, containerWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvasElement = canvasRef.current;
        const context = canvasElement?.getContext("2d");
        if (!canvasElement || !context) throw new Error("PDF preview is unavailable in this browser.");
        canvasElement.width = Math.ceil(viewport.width);
        canvasElement.height = Math.ceil(viewport.height);
        canvasElement.style.width = `${viewport.width}px`;
        canvasElement.style.height = `${viewport.height}px`;
        const renderTask = page.render({ canvas: null, canvasContext: context, viewport });
        cancelRender = () => renderTask.cancel();
        await renderTask.promise;
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "PDF preview could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void renderPage();
    return () => {
      active = false;
      cancelRender?.();
      void loadingTask?.destroy();
    };
  }, [attempt, containerWidth, pageNumber, url]);

  return (
    <div className="space-y-2">
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={pageNumber <= 1} aria-label="Previous PDF page" onClick={() => {
            setLoading(true);
            setError("");
            setPageNumber((current) => current - 1);
          }}>Previous</Button>
          <span aria-live="polite">Page {pageNumber} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={pageNumber >= pageCount} aria-label="Next PDF page" onClick={() => {
            setLoading(true);
            setError("");
            setPageNumber((current) => current + 1);
          }}>Next</Button>
        </div>
      ) : null}
      <div ref={containerRef} className="relative flex min-h-40 justify-center overflow-hidden rounded-lg border bg-white p-2">
        <canvas ref={canvasRef} aria-label={`${filename}, page ${pageNumber}`} className="h-auto max-w-full shadow-sm" />
        {loading ? <p role="status" className="absolute inset-0 flex items-center justify-center bg-white/90 text-sm text-muted-foreground">Rendering PDF preview…</p> : null}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white p-4 text-center">
            <p role="alert" className="text-sm text-muted-foreground">PDF preview unavailable. Download the attachment to view it.</p>
            <Button variant="outline" size="sm" onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((current) => current + 1);
            }}>Try preview again</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

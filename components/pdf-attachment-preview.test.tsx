import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const renderPage = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
  const getPage = vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 300 * scale, height: 160 * scale }),
    render: renderPage,
  }));
  const document = { numPages: 2, getPage, destroy: vi.fn().mockResolvedValue(undefined) };
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve(document),
    destroy: vi.fn().mockResolvedValue(undefined),
  }));
  return { document, getDocument, getPage, renderPage };
});

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: mocks.getDocument,
}));

import { PdfAttachmentPreview } from "./pdf-attachment-preview";

afterEach(() => vi.restoreAllMocks());

describe("PdfAttachmentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocument.mockReturnValue({
      promise: Promise.resolve(mocks.document),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  });

  it("renders a PDF page and supports paging through the attachment", async () => {
    render(<PdfAttachmentPreview url="/api/email.pdf" filename="invoice.pdf" />);

    const firstPage = await screen.findByLabelText("invoice.pdf, page 1");
    await waitFor(() => expect(mocks.renderPage).toHaveBeenCalledOnce());
    expect(firstPage).toHaveAttribute("width", "300");
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next PDF page" }));
    expect(await screen.findByLabelText("invoice.pdf, page 2")).toBeInTheDocument();
    await waitFor(() => expect(mocks.renderPage).toHaveBeenCalledTimes(2));
  });

  it("does not start a PDF task from a replayed, cancelled effect", async () => {
    render(<StrictMode><PdfAttachmentPreview url="/api/email.pdf" filename="invoice.pdf" /></StrictMode>);

    await screen.findByLabelText("invoice.pdf, page 1");
    await waitFor(() => expect(mocks.renderPage).toHaveBeenCalledOnce());
    expect(mocks.getDocument).toHaveBeenCalledOnce();
  });

  it("explains when a PDF cannot be rendered", async () => {
    mocks.getDocument.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error("PDF is invalid.")),
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    render(<PdfAttachmentPreview url="/api/email.pdf" filename="invoice.pdf" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Download the attachment to view it.");
    expect(screen.getByRole("button", { name: "Try preview again" })).toBeInTheDocument();
  });
});

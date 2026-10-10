import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maxPhotoIdUploadSize, preparePhotoId } from "./prepare-photo-id";

const convert = vi.hoisted(() => vi.fn());
vi.mock("heic-to/csp", () => ({ heicTo: convert }));

describe("preparePhotoId", () => {
  const decode = vi.fn();
  const drawImage = vi.fn();
  const toBlob = vi.fn();
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    decode.mockReset().mockResolvedValue(undefined);
    convert.mockReset().mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    vi.stubGlobal("Image", class {
      src = "";
      naturalWidth = 4800;
      naturalHeight = 3200;
      decode = decode;
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:photo"), revokeObjectURL: vi.fn() });
    canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({
      fillStyle: "", fillRect: vi.fn(), drawImage,
    } as unknown as CanvasRenderingContext2D);
    toBlob.mockReset().mockImplementation((callback: BlobCallback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
    vi.spyOn(canvas, "toBlob").mockImplementation(toBlob);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((name, options) =>
      name === "canvas" ? canvas : createElement(name, options));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves small images and PDFs including the exact upload limit", async () => {
    for (const type of ["image/jpeg", "application/pdf"]) {
      const file = new File([new Uint8Array(maxPhotoIdUploadSize)], "id", { type });
      expect(await preparePhotoId(file)).toBe(file);
    }
    expect(decode).not.toHaveBeenCalled();
  });

  it("resizes a 10 MB photo to JPEG within the upload limit", async () => {
    const result = await preparePhotoId(new File([new Uint8Array(10 * 1024 * 1024)], "front.png", { type: "image/png" }));
    expect(result.name).toBe("front.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBeLessThanOrEqual(maxPhotoIdUploadSize);
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1600);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("converts HEIC even below the upload limit", async () => {
    const file = new File(["heic"], "front.heic");
    expect((await preparePhotoId(file)).type).toBe("image/jpeg");
    expect(convert).toHaveBeenCalledWith({ blob: file, type: "image/jpeg", quality: 0.9 });
  });

  it("converts HEIF photos identified by MIME type without an extension", async () => {
    const file = new File(["heif"], "photo", { type: "image/heif" });
    expect((await preparePhotoId(file)).type).toBe("image/jpeg");
    expect(convert).toHaveBeenCalledWith({ blob: file, type: "image/jpeg", quality: 0.9 });
  });

  it("reduces quality until the encoded file fits", async () => {
    toBlob.mockImplementationOnce((callback: BlobCallback) => callback(new Blob([new Uint8Array(maxPhotoIdUploadSize + 1)])));
    await preparePhotoId(new File([new Uint8Array(2 * 1024 * 1024)], "front.jpg"));
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(toBlob.mock.calls[1][2]).toBe(0.8);
  });

  it("rejects oversized originals and PDFs with actionable errors", async () => {
    await expect(preparePhotoId(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "front.jpg"))).rejects.toThrow("10 MB");
    await expect(preparePhotoId(new File([new Uint8Array(maxPhotoIdUploadSize + 1)], "front.pdf"))).rejects.toThrow("PDF files");
    await expect(preparePhotoId(new File([], "empty.jpg"))).rejects.toThrow("non-empty");
  });

  it("reports conversion and decoding failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    convert.mockRejectedValueOnce(new Error("invalid"));
    await expect(preparePhotoId(new File(["heic"], "id.heic"))).rejects.toThrow("export it as JPEG");
    expect(log).toHaveBeenCalledWith("Photo ID HEIC conversion failed:", expect.any(Error));
    decode.mockRejectedValueOnce(new Error("invalid"));
    await expect(preparePhotoId(new File([new Uint8Array(2 * 1024 * 1024)], "id.jpg"))).rejects.toThrow("could not read");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("reports failed or insufficient compression instead of sending an oversized file", async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], "id.jpg");
    toBlob.mockImplementationOnce((callback: BlobCallback) => callback(null));
    await expect(preparePhotoId(file)).rejects.toThrow("could not resize");
    toBlob.mockImplementation((callback: BlobCallback) => callback(new Blob([new Uint8Array(maxPhotoIdUploadSize + 1)])));
    await expect(preparePhotoId(file)).rejects.toThrow("still too large");
  });
});

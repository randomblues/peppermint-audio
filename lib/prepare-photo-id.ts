const maxOriginalSize = 10 * 1024 * 1024;
export const maxPhotoIdUploadSize = 1.5 * 1024 * 1024;

export async function preparePhotoId(file: File): Promise<File> {
  if (!file.size) throw new Error("Please choose a non-empty photo ID file.");
  if (file.size > maxOriginalSize) throw new Error("Each photo ID image must be 10 MB or smaller.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > maxPhotoIdUploadSize) throw new Error("PDF files must be 1.5 MB or smaller. Please upload photos instead for larger files.");
    return file;
  }
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic && file.size <= maxPhotoIdUploadSize) return file;
  let source: Blob = file;
  if (isHeic) {
    try {
      const { heicTo } = await import("heic-to/csp");
      source = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    } catch (error) {
      console.error("Photo ID HEIC conversion failed:", error);
      throw new Error("We could not read this HEIC photo. Please export it as JPEG and try again.");
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("We could not read this photo. Please choose a JPEG, PNG or WebP image.");
    }
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo resizing is unavailable. Please try another browser or a smaller photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("We could not resize this photo. Please try another image.");
      if (blob.size <= maxPhotoIdUploadSize) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("This photo is still too large after resizing. Please crop it to the ID and try again.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

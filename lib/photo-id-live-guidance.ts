type FramePixels = {
  data: ArrayLike<number>;
  width: number;
  height: number;
};

type EdgePeak = { position: number; strength: number };

function strongestEdge(profile: number[], start: number, end: number): EdgePeak {
  let position = start;
  for (let index = start + 1; index < end; index += 1) {
    if (profile[index] > profile[position]) position = index;
  }
  return { position, strength: profile[position] ?? 0 };
}

export function getPhotoIdLiveGuidance({ data, width, height }: FramePixels): string {
  if (!width || !height || data.length < width * height * 4) {
    return "Line up your ID in the frame.";
  }

  const grayscale = new Uint8Array(width * height);
  let brightnessTotal = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
    const offset = pixel * 4;
    const brightness = Math.round(data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722);
    grayscale[pixel] = brightness;
    brightnessTotal += brightness;
    if (brightness < 45) darkPixels += 1;
    if (brightness > 245) brightPixels += 1;
  }

  const isTooDark = brightnessTotal / grayscale.length < 65 || darkPixels / grayscale.length > 0.55;
  const hasGlare = brightPixels / grayscale.length > 0.98;

  const verticalEdges = new Array<number>(width).fill(0);
  const horizontalEdges = new Array<number>(height).fill(0);
  const xStart = Math.floor(width * 0.08);
  const xEnd = Math.ceil(width * 0.92);
  const yStart = Math.floor(height * 0.08);
  const yEnd = Math.ceil(height * 0.92);

  for (let x = 1; x < width - 1; x += 1) {
    let edgeCount = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      if (Math.abs(grayscale[y * width + x] - grayscale[y * width + x - 1]) >= 24) edgeCount += 1;
    }
    verticalEdges[x] = edgeCount / Math.max(1, yEnd - yStart);
  }
  for (let y = 1; y < height - 1; y += 1) {
    let edgeCount = 0;
    for (let x = xStart; x < xEnd; x += 1) {
      if (Math.abs(grayscale[y * width + x] - grayscale[(y - 1) * width + x]) >= 24) edgeCount += 1;
    }
    horizontalEdges[y] = edgeCount / Math.max(1, xEnd - xStart);
  }

  const left = strongestEdge(verticalEdges, 1, Math.floor(width * 0.4));
  const right = strongestEdge(verticalEdges, Math.ceil(width * 0.6), width - 1);
  const top = strongestEdge(horizontalEdges, 1, Math.floor(height * 0.4));
  const bottom = strongestEdge(horizontalEdges, Math.ceil(height * 0.6), height - 1);
  if (Math.min(left.strength, right.strength, top.strength, bottom.strength) < 0.25) {
    const borderHasCardEdge = Math.max(
      ...verticalEdges.slice(1, Math.ceil(width * 0.04)),
      ...verticalEdges.slice(Math.floor(width * 0.96), width - 1),
      ...horizontalEdges.slice(1, Math.ceil(height * 0.04)),
      ...horizontalEdges.slice(Math.floor(height * 0.96), height - 1),
    ) >= 0.25;
    if (borderHasCardEdge) return "Move back slightly so all four corners fit in the frame.";
    if (isTooDark) return "Add more light so the details are visible.";
    if (hasGlare) return "Reduce glare by tilting the card slightly.";
    return "Place your ID in the frame and keep all four edges visible.";
  }

  const leftRatio = left.position / width;
  const rightRatio = right.position / width;
  const topRatio = top.position / height;
  const bottomRatio = bottom.position / height;
  const cardWidth = rightRatio - leftRatio;
  const cardHeight = bottomRatio - topRatio;
  const cardArea = cardWidth * cardHeight;

  if (leftRatio < 0.02 || rightRatio > 0.98 || topRatio < 0.02 || bottomRatio > 0.98 || cardArea > 0.94) {
    return "Move back slightly so all four corners fit in the frame.";
  }
  if (cardWidth < 0.55 || cardHeight < 0.45 || cardArea < 0.28) {
    return "If the card looks small, move a little closer.";
  }
  if (isTooDark) return "Add more light so the details are visible.";
  if (hasGlare) return "Reduce glare by tilting the card slightly.";

  let laplacianTotal = 0;
  let laplacianSquaredTotal = 0;
  let sampleCount = 0;
  const focusMargin = 4;
  for (let y = top.position + focusMargin; y < bottom.position - focusMargin; y += 1) {
    for (let x = left.position + focusMargin; x < right.position - focusMargin; x += 1) {
      const index = y * width + x;
      const laplacian = grayscale[index - width]
        + grayscale[index - 1]
        + grayscale[index + 1]
        + grayscale[index + width]
        - 4 * grayscale[index];
      laplacianTotal += laplacian;
      laplacianSquaredTotal += laplacian * laplacian;
      sampleCount += 1;
    }
  }
  const laplacianVariance = laplacianSquaredTotal / sampleCount - (laplacianTotal / sampleCount) ** 2;
  if (laplacianVariance < 12) return "Hold steady so the card stays in focus.";

  return "Looks good. Hold steady and capture.";
}

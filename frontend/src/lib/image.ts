/**
 * Shrinking a proof photo before it leaves the phone.
 *
 * A picture straight out of a camera is three to six megabytes, which is slow
 * on a phone network, over the serverless request limit, and far more detail
 * than two people squinting at a card need. Everything here happens in the
 * browser: the bytes that reach us are already the bytes we keep.
 */

/** Longest side after resizing. Enough to read a commit hash off a screenshot. */
const MAX_EDGE = 1600;

/**
 * Floor for the *short* side, which is what makes a phone screenshot legible.
 * Capping only the long edge punishes tall images: a 780×2556 screenshot comes
 * out 378 wide, below the width it was captured at, and the text goes soft.
 */
const MIN_EDGE = 720;

/** A ceiling on total pixels, so an extreme aspect ratio cannot eat the tab. */
const MAX_PIXELS = MAX_EDGE * MAX_EDGE;

/** What we aim to land under. Quality steps down until the result fits. */
const TARGET_BYTES = 320 * 1024;

/**
 * Tried in order. The first step is where photographs already look untouched;
 * the rest exist for screenshots of dense text, which start out much larger.
 */
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
  /** What the encoder settled on, so the UI can be honest about it. */
  quality: number;
}

let webpSupport: boolean | null = null;

/**
 * WebP holds text far better than JPEG at the same weight, which matters when
 * half the proofs are screenshots. Not every WebView can encode it, so this is
 * asked rather than assumed.
 */
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp');
  return webpSupport;
}

/** `createImageBitmap` is not everywhere, and only it reads EXIF rotation. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some older WebViews accept the call and reject the option.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const source = await decode(file);
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;

  const longest = Math.max(sourceWidth, sourceHeight);
  const shortest = Math.min(sourceWidth, sourceHeight);

  // Shrink to the long edge, unless doing so would take the short edge below
  // what a screenshot needs to stay readable. Never enlarge anything.
  let scale = Math.min(1, Math.max(MAX_EDGE / longest, Math.min(1, MIN_EDGE / shortest)));
  const pixels = sourceWidth * scale * sourceHeight * scale;
  if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels);

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал холст для сжатия');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // A photo of a receipt on a dark table is still a photo; the white ground
  // matters only for anything transparent, which a proof rarely is.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ('close' in source) source.close();

  const type = supportsWebp() ? 'image/webp' : 'image/jpeg';

  let blob: Blob | null = null;
  let quality = QUALITY_STEPS[0];
  for (const step of QUALITY_STEPS) {
    const attempt = await encode(canvas, type, step);
    if (!attempt) continue;
    blob = attempt;
    quality = step;
    if (attempt.size <= TARGET_BYTES) break;
  }

  if (!blob) throw new Error('Не удалось сжать изображение');

  return { blob, width, height, originalBytes: file.size, quality };
}

/** «2,4 МБ» / «180 КБ» — for telling someone what just happened to their photo. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
  return `${Math.round(bytes / 1024)} КБ`;
}

import {sourceFileError, isHeicFile, fitWithin, isValidProductPhoto, photoKilobytes, PHOTO_ENCODE_STEPS, PHOTO_TARGET_CHARS, PHOTO_MESSAGES} from '@/lib/product-photo';

export type CompressedPhoto = {dataUrl: string; width: number; height: number; kilobytes: number};
/** Part of the picture to keep, as fractions of its width and height. */
export type PhotoCrop = {x: number; y: number; w: number; h: number};

type Decoded = {source: CanvasImageSource; width: number; height: number; release(): void};

// Browser only: no DOM access at module load, so client components can import it during SSR builds.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation applies EXIF rotation, so portrait phone photos stay upright.
      const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
      return {source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close()};
    } catch { /* fall back to <img>, which some browsers decode more formats with */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw Error('empty image');
    return {source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {}};
  } finally { URL.revokeObjectURL(url); }
}

/** Resizes and compresses a picked file into a small data URL. Throws Error with a Georgian message. */
export async function compressProductPhoto(file: File, crop?: PhotoCrop): Promise<CompressedPhoto> {
  const sourceError = sourceFileError(file);
  if (sourceError) throw Error(sourceError);
  let decoded: Decoded;
  try { decoded = await decode(file); }
  catch { throw Error(isHeicFile(file) ? PHOTO_MESSAGES.heic : PHOTO_MESSAGES.notImage); }
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error(PHOTO_MESSAGES.tooHeavy);
    let best: CompressedPhoto | null = null;
    const sx = (crop?.x ?? 0) * decoded.width, sy = (crop?.y ?? 0) * decoded.height;
    const sw = (crop?.w ?? 1) * decoded.width, sh = (crop?.h ?? 1) * decoded.height;
    for (const step of PHOTO_ENCODE_STEPS) {
      const {width, height} = fitWithin(Math.round(sw), Math.round(sh), step.maxSide);
      canvas.width = width; canvas.height = height;
      // White underlay so transparent PNGs do not turn black in JPEG.
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, width, height);
      let dataUrl = canvas.toDataURL('image/webp', step.quality);
      if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', step.quality);
      if (!isValidProductPhoto(dataUrl)) continue;
      const result = {dataUrl, width, height, kilobytes: photoKilobytes(dataUrl)};
      if (dataUrl.length <= PHOTO_TARGET_CHARS) return result;
      if (!best || dataUrl.length < best.dataUrl.length) best = result;
    }
    if (best) return best;
    throw Error(PHOTO_MESSAGES.tooHeavy);
  } finally {
    decoded.release();
  }
}

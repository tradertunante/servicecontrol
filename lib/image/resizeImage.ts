/**
 * Client-side image resize using Canvas API.
 * Reduces large photos before uploading to Supabase Storage.
 *
 * - Max dimension: 1920px (longest side)
 * - Output format: JPEG at 0.82 quality (~80-120KB for typical audit photos)
 * - Preserves aspect ratio
 * - Returns original file if already small enough or if canvas is unavailable
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export async function resizeImage(file: File): Promise<File> {
  // Only process images
  if (!file.type.startsWith("image/")) return file;

  // Skip if already small (< 300KB)
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Skip resize if already within limits
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      bitmap.close();
      // Still compress to JPEG if it's a large PNG/HEIC
      if (file.type === "image/jpeg" && file.size < 500 * 1024) return file;
    }

    // Calculate new dimensions preserving aspect ratio
    let newWidth = width;
    let newHeight = height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    // Canvas unavailable (e.g. old browser) — upload original
    return file;
  }
}

/**
 * Draws a single video frame to a canvas, scales it so the longest edge
 * is at most maxPx, and returns a base64 JPEG data URL.
 */
export function compressFrame(
  videoEl: HTMLVideoElement,
  maxPx = 1200
): string {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;

  if (srcW === 0 || srcH === 0) return "";

  const scale = Math.min(1, maxPx / Math.max(srcW, srcH));
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(videoEl, 0, 0, dstW, dstH);
  return canvas.toDataURL("image/jpeg", 0.85);
}

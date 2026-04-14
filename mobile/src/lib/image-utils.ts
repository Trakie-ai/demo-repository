export interface CropRect {
  /** X offset relative to the video element's client box */
  x: number;
  /** Y offset relative to the video element's client box */
  y: number;
  width: number;
  height: number;
}

/**
 * Draws a single video frame to a canvas, optionally cropped to a region
 * given in the video element's client coordinate space. Because the video
 * is rendered with `object-cover`, the element coordinates are mapped back
 * to source pixels via the cover scale and centering offset.
 *
 * Returns a base64 JPEG data URL, downscaled so the longest edge is
 * at most `maxPx`.
 */
export function compressFrame(
  videoEl: HTMLVideoElement,
  cropRect?: CropRect,
  maxPx = 1200
): string {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;

  if (srcW === 0 || srcH === 0) return "";

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
    const elW = videoEl.clientWidth;
    const elH = videoEl.clientHeight;

    // object-cover: scale video so it fully covers the element, then center.
    const coverScale = Math.max(elW / srcW, elH / srcH);
    const displayedW = srcW * coverScale;
    const displayedH = srcH * coverScale;
    const offsetX = (elW - displayedW) / 2;
    const offsetY = (elH - displayedH) / 2;

    sx = (cropRect.x - offsetX) / coverScale;
    sy = (cropRect.y - offsetY) / coverScale;
    sw = cropRect.width / coverScale;
    sh = cropRect.height / coverScale;

    // Clamp to the source video bounds.
    sx = Math.max(0, Math.min(sx, srcW));
    sy = Math.max(0, Math.min(sy, srcH));
    sw = Math.max(1, Math.min(sw, srcW - sx));
    sh = Math.max(1, Math.min(sh, srcH - sy));
  }

  const scale = Math.min(1, maxPx / Math.max(sw, sh));
  const dstW = Math.round(sw * scale);
  const dstH = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, dstW, dstH);
  return canvas.toDataURL("image/jpeg", 0.85);
}

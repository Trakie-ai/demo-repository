"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { compressFrame } from "@/lib/image-utils";

const MAD_THRESHOLD = 8.0;
const STABLE_FRAMES_REQUIRED = 10;
const DETECTION_INTERVAL_MS = 100;
const OFFSCREEN_WIDTH = 160;
const OFFSCREEN_HEIGHT = 120;

// Minimum edge density (0–1) to consider a document present in frame.
// A blank wall/ceiling is ~0.02–0.05; a document with text is typically 0.10+.
const EDGE_DENSITY_THRESHOLD = 0.08;

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStable: boolean;
  stableProgress: number; // 0–1
  capture: () => string;
}

/**
 * Compute edge density in the center region of a grayscale frame using
 * a simple Sobel-like gradient magnitude check. Returns 0–1 representing
 * the fraction of pixels that exceed the edge threshold.
 */
function computeEdgeDensity(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): number {
  // Convert to grayscale luminance (center 60% of frame only)
  const marginX = Math.floor(width * 0.2);
  const marginY = Math.floor(height * 0.2);
  const roiW = width - marginX * 2;
  const roiH = height - marginY * 2;

  // Build grayscale buffer for ROI
  const gray = new Uint8Array(roiW * roiH);
  for (let y = 0; y < roiH; y++) {
    for (let x = 0; x < roiW; x++) {
      const srcIdx = ((y + marginY) * width + (x + marginX)) * 4;
      // Fast luminance: (R + R + G + G + G + B) / 6
      gray[y * roiW + x] = (pixels[srcIdx] * 2 + pixels[srcIdx + 1] * 3 + pixels[srcIdx + 2]) / 6;
    }
  }

  // Sobel edge detection
  const EDGE_THRESHOLD = 30;
  let edgeCount = 0;
  let totalPixels = 0;

  for (let y = 1; y < roiH - 1; y++) {
    for (let x = 1; x < roiW - 1; x++) {
      const idx = y * roiW + x;
      // Horizontal gradient (Sobel Gx simplified)
      const gx =
        -gray[idx - roiW - 1] + gray[idx - roiW + 1] +
        -2 * gray[idx - 1] + 2 * gray[idx + 1] +
        -gray[idx + roiW - 1] + gray[idx + roiW + 1];
      // Vertical gradient (Sobel Gy simplified)
      const gy =
        -gray[idx - roiW - 1] - 2 * gray[idx - roiW] - gray[idx - roiW + 1] +
        gray[idx + roiW - 1] + 2 * gray[idx + roiW] + gray[idx + roiW + 1];

      const magnitude = Math.abs(gx) + Math.abs(gy);
      if (magnitude > EDGE_THRESHOLD) edgeCount++;
      totalPixels++;
    }
  }

  return totalPixels > 0 ? edgeCount / totalPixels : 0;
}

export function useCamera(onAutoCapture: (imageData: string) => void): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [stableProgress, setStableProgress] = useState(0);

  // Refs for values used inside the interval callback
  const stableCountRef = useRef(0);
  const capturedRef = useRef(false);
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const capture = useCallback((): string => {
    const video = videoRef.current;
    if (!video) return "";
    return compressFrame(video);
  }, []);

  useEffect(() => {
    let stopped = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      } catch (err) {
        console.error("[use-camera] getUserMedia failed:", err);
      }
    }

    startCamera();

    // Offscreen canvas for MAD + edge computation
    const offscreen = document.createElement("canvas");
    offscreen.width = OFFSCREEN_WIDTH;
    offscreen.height = OFFSCREEN_HEIGHT;
    offscreenRef.current = offscreen;

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      const canvas = offscreenRef.current;
      if (!video || !canvas || video.readyState < 2 || capturedRef.current) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
      const frameData = ctx.getImageData(0, 0, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
      const pixels = frameData.data;

      const prev = prevPixelsRef.current;
      if (prev) {
        // 1. Motion check (MAD)
        let sum = 0;
        for (let i = 0; i < pixels.length; i++) {
          sum += Math.abs(pixels[i] - prev[i]);
        }
        const mad = sum / pixels.length;

        // 2. Edge density check — is there a document in frame?
        const edgeDensity = computeEdgeDensity(pixels, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
        const hasDocument = edgeDensity >= EDGE_DENSITY_THRESHOLD;

        if (mad < MAD_THRESHOLD && hasDocument) {
          stableCountRef.current = Math.min(
            stableCountRef.current + 1,
            STABLE_FRAMES_REQUIRED
          );
        } else {
          // Reset if moving OR no document detected
          stableCountRef.current = Math.max(stableCountRef.current - 1, 0);
        }

        const progress = stableCountRef.current / STABLE_FRAMES_REQUIRED;
        setStableProgress(progress);
        setIsStable(stableCountRef.current >= STABLE_FRAMES_REQUIRED);

        if (stableCountRef.current >= STABLE_FRAMES_REQUIRED && !capturedRef.current) {
          capturedRef.current = true;
          const imageData = compressFrame(video);
          navigator.vibrate?.(100);
          onAutoCapture(imageData);
        }
      }

      // Store a copy for next comparison
      prevPixelsRef.current = new Uint8ClampedArray(pixels);
    }, DETECTION_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(intervalId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      prevPixelsRef.current = null;
      stableCountRef.current = 0;
      capturedRef.current = false;
    };
  }, [onAutoCapture]);

  return { videoRef, isStable, stableProgress, capture };
}

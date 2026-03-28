"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { compressFrame } from "@/lib/image-utils";

const MAD_THRESHOLD = 8.0;
const STABLE_FRAMES_REQUIRED = 10;
const DETECTION_INTERVAL_MS = 100;
const OFFSCREEN_WIDTH = 160;
const OFFSCREEN_HEIGHT = 120;

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStable: boolean;
  stableProgress: number; // 0–1
  capture: () => string;
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

    // Offscreen canvas for MAD computation
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
      const imageData = ctx.getImageData(0, 0, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
      const pixels = imageData.data;

      const prev = prevPixelsRef.current;
      if (prev) {
        let sum = 0;
        for (let i = 0; i < pixels.length; i++) {
          sum += Math.abs(pixels[i] - prev[i]);
        }
        const mad = sum / pixels.length;

        if (mad < MAD_THRESHOLD) {
          stableCountRef.current = Math.min(
            stableCountRef.current + 1,
            STABLE_FRAMES_REQUIRED
          );
        } else {
          stableCountRef.current = 0;
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

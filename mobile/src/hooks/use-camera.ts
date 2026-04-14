"use client";

import { useEffect, useRef, useCallback } from "react";
import { compressFrame, type CropRect } from "@/lib/image-utils";

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  capture: (cropRect?: CropRect) => string;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const capture = useCallback((cropRect?: CropRect): string => {
    const video = videoRef.current;
    if (!video) return "";
    return compressFrame(video, cropRect);
  }, []);

  useEffect(() => {
    let stopped = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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

    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, capture };
}

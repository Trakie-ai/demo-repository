"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { RELAY_URL } from "@/lib/constants";

export type RelayStatus =
  | "idle"
  | "connecting"
  | "joined"
  | "paired"
  | "disconnected"
  | "error";

export type ExtractionPhase = "idle" | "processing" | "complete" | "error";

export function useRelay(sessionId: string | null) {
  const [status, setStatus] = useState<RelayStatus>("idle");
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>("idle");
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    setStatus("connecting");

    const socket: Socket = io(RELAY_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    function joinSession() {
      socket.emit(
        "session:join",
        { sessionId, deviceType: "mobile" as const },
        (res: { ok: boolean; error?: string }) => {
          if (res.ok) {
            setStatus("joined");
          } else {
            console.error("[trakie] join failed:", res.error);
            setStatus("error");
          }
        }
      );
    }

    socket.on("connect", () => {
      joinSession();
    });

    socket.on("session:paired", () => {
      setStatus("paired");
    });

    socket.on("session:device-disconnected", () => {
      setStatus("joined");
    });

    socket.on("extraction:started", () => {
      setExtractionError(null);
      setExtractionPhase("processing");
    });

    socket.on("extraction:complete", () => {
      setExtractionPhase("complete");
    });

    socket.on("extraction:error", (data: { error: string }) => {
      setExtractionError(data?.error ?? "Extraction failed");
      setExtractionPhase("error");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setStatus("error");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const sendImage = useCallback(
    (imageData: string, captureType: "invoice" | "label" = "invoice") => {
      const socket = socketRef.current;
      if (!socket || !sessionId) return;
      setExtractionError(null);
      setExtractionPhase("processing");
      socket.emit("image:captured", {
        sessionId,
        imageData,
        captureType,
      });
    },
    [sessionId]
  );

  const resetExtraction = useCallback(() => {
    setExtractionError(null);
    setExtractionPhase("idle");
  }, []);

  return {
    status,
    disconnect,
    sendImage,
    extractionPhase,
    extractionError,
    resetExtraction,
  };
}

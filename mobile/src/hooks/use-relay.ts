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

export function useRelay(sessionId: string | null) {
  const [status, setStatus] = useState<RelayStatus>("idle");
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
    (imageData: string) => {
      const socket = socketRef.current;
      if (!socket || !sessionId) return;
      socket.emit("image:captured", {
        sessionId,
        imageData,
        captureType: "invoice" as const,
      });
    },
    [sessionId]
  );

  return { status, disconnect, sendImage };
}

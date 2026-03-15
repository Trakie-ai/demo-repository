"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
}

export function QrScanner({ onScan }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scanner = new Html5Qrcode(containerRef.current.id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(console.error);
          onScan(decodedText);
        },
        undefined
      )
      .catch((err) => {
        console.error("[trakie] QR scanner error:", err);
      });

    return () => {
      scanner
        .stop()
        .catch(() => {
          // scanner may already be stopped
        });
    };
  }, [onScan]);

  return (
    <div
      id="qr-reader"
      ref={containerRef}
      className="w-full max-w-sm overflow-hidden rounded-xl border border-border"
    />
  );
}

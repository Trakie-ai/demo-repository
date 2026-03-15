"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrScanner } from "@/components/qr-scanner";
import { useRelay, type RelayStatus } from "@/hooks/use-relay";

const STATUS_CONFIG: Record<
  RelayStatus,
  { label: string; dotClass: string }
> = {
  idle: { label: "Initializing…", dotClass: "" },
  connecting: { label: "Connecting…", dotClass: "" },
  joined: { label: "Waiting for extension…", dotClass: "" },
  paired: { label: "Connected", dotClass: "bg-primary" },
  disconnected: { label: "Disconnected", dotClass: "bg-red-500" },
  error: { label: "Connection error", dotClass: "bg-red-500" },
};

function ReceiveContent() {
  const searchParams = useSearchParams();
  const urlSession = searchParams.get("session");

  const [sessionId, setSessionId] = useState<string | null>(urlSession);
  const { status } = useRelay(sessionId);

  const handleScan = useCallback((decodedText: string) => {
    try {
      const url = new URL(decodedText);
      const session = url.searchParams.get("session");
      if (session) {
        setSessionId(session);
      }
    } catch {
      // Not a valid URL, ignore
    }
  }, []);

  const { label, dotClass } = STATUS_CONFIG[status];
  const showScanner = !sessionId;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-primary-light">Trakie</h1>
        <span className="text-sm text-text-secondary">
          Inventory Receiving
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {showScanner ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-text-secondary">
              Scan the QR code from your Trakie extension
            </p>
            <QrScanner onScan={handleScan} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-card border border-border">
              <span className="text-2xl">
                {status === "paired" ? "\u2705" : "\uD83D\uDCE6"}
              </span>
            </div>
            <h2 className="text-xl font-semibold">
              {status === "paired"
                ? "Device Paired"
                : "Inventory Receiving"}
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${dotClass || "bg-text-secondary"}`}
              />
              <span className="text-sm text-text-secondary">{label}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ReceivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
          Loading…
        </div>
      }
    >
      <ReceiveContent />
    </Suspense>
  );
}

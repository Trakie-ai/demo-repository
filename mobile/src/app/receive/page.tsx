"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrScanner } from "@/components/qr-scanner";
import { useRelay, type RelayStatus } from "@/hooks/use-relay";
import { useCamera } from "@/hooks/use-camera";

// ─── Status label config (non-capturing states) ────────────────────────────

const STATUS_CONFIG: Record<
  Exclude<RelayStatus, "idle" | "paired">,
  { label: string; dotClass: string }
> = {
  connecting: { label: "Connecting…", dotClass: "" },
  joined: { label: "Waiting for extension…", dotClass: "" },
  disconnected: { label: "Disconnected", dotClass: "bg-red-500" },
  error: { label: "Connection error", dotClass: "bg-red-500" },
};

// ─── Progress ring (SVG) ───────────────────────────────────────────────────

function ProgressRing({
  progress,
  isStable,
}: {
  progress: number;
  isStable: boolean;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="rotate-[-90deg]">
      {/* Track */}
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      {/* Progress */}
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={isStable ? "#4ade80" : "#ffffff"}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.2s" }}
      />
    </svg>
  );
}

// ─── Corner brackets overlay ──────────────────────────────────────────────

function CornerBrackets({ isStable }: { isStable: boolean }) {
  const color = isStable ? "#4ade80" : "rgba(255,255,255,0.8)";
  const size = 28;
  const stroke = 3;

  const corner = (
    top: boolean,
    left: boolean
  ) => {
    const x = left ? 0 : "100%";
    const y = top ? 0 : "100%";
    const dx = left ? size : -size;
    const dy = top ? size : -size;

    return (
      <g key={`${top}-${left}`}>
        <line
          x1={x}
          y1={y}
          x2={typeof x === "number" ? x + dx : `calc(${x} + ${dx}px)`}
          y2={y}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "stroke 0.3s" }}
        />
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={typeof y === "number" ? y + dy : `calc(${y} + ${dy}px)`}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "stroke 0.3s" }}
        />
      </g>
    );
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      overflow="visible"
    >
      {corner(true, true)}
      {corner(true, false)}
      {corner(false, true)}
      {corner(false, false)}
    </svg>
  );
}

// ─── Camera view ──────────────────────────────────────────────────────────

type CapturePhase = "capturing" | "sent";

function CameraView({
  onCapture,
}: {
  onCapture: (imageData: string) => void;
}) {
  const [phase, setPhase] = useState<CapturePhase>("capturing");
  const [flash, setFlash] = useState(false);

  const handleAutoCapture = useCallback(
    (imageData: string) => {
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      onCapture(imageData);
      setPhase("sent");
    },
    [onCapture]
  );

  const { videoRef, isStable, stableProgress } = useCamera(handleAutoCapture);

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-black">
      {/* Full-screen video feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Flash overlay */}
      {flash && (
        <div className="absolute inset-0 bg-white opacity-60 pointer-events-none z-10" />
      )}

      {/* Corner-bracket guide box */}
      <div
        className="relative z-20"
        style={{ width: "72%", aspectRatio: "3/4", maxWidth: 340 }}
      >
        <CornerBrackets isStable={isStable} />

        {/* "Hold still" label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{
              color: isStable ? "#4ade80" : "rgba(255,255,255,0.7)",
              transition: "color 0.3s",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {phase === "sent" ? "Sent ✓" : isStable ? "Capturing…" : "Hold still"}
          </span>
        </div>
      </div>

      {/* Progress ring */}
      <div className="relative z-20 mt-8">
        <ProgressRing progress={stableProgress} isStable={isStable} />
      </div>

      {/* "Sent" confirmation overlay */}
      {phase === "sent" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
          <span className="text-5xl">✓</span>
          <p className="mt-4 text-lg font-semibold text-white">Image sent</p>
          <p className="mt-1 text-sm text-white/60">Extension received the image</p>
        </div>
      )}
    </div>
  );
}

// ─── Main receive content ──────────────────────────────────────────────────

function ReceiveContent() {
  const searchParams = useSearchParams();
  const urlSession = searchParams.get("session");

  const [sessionId, setSessionId] = useState<string | null>(urlSession);
  const [appState, setAppState] = useState<"connecting" | "capturing">("connecting");

  const { status, sendImage } = useRelay(sessionId);

  // Auto-transition to capturing once paired
  useEffect(() => {
    if (status === "paired" && appState === "connecting") {
      setAppState("capturing");
    }
  }, [status, appState]);

  const handleScan = useCallback((decodedText: string) => {
    try {
      const url = new URL(decodedText);
      const session = url.searchParams.get("session");
      if (session) setSessionId(session);
    } catch {
      // Not a valid URL, ignore
    }
  }, []);

  const handleCapture = useCallback(
    (imageData: string) => {
      sendImage(imageData);
    },
    [sendImage]
  );

  // ── Camera view (after paired) ──
  if (appState === "capturing") {
    return <CameraView onCapture={handleCapture} />;
  }

  // ── Connection / QR-scan view ──
  const showScanner = !sessionId;
  const nonPaired = status === "idle" || status === "paired"
    ? { label: "Connecting…", dotClass: "" }
    : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const { label, dotClass } = nonPaired;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-primary-light">Trakie</h1>
        <span className="text-sm text-text-secondary">Inventory Receiving</span>
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
                {status === "paired" ? "✅" : "📦"}
              </span>
            </div>
            <h2 className="text-xl font-semibold">
              {status === "paired" ? "Device Paired" : "Inventory Receiving"}
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

// ─── Page export ───────────────────────────────────────────────────────────

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

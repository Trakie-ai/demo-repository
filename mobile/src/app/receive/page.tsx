"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrScanner } from "@/components/qr-scanner";
import { useRelay, type RelayStatus } from "@/hooks/use-relay";
import { useCamera } from "@/hooks/use-camera";

// ─── Status label config (non-capturing states) ────────────────────────────

const STATUS_CONFIG: Record<
  Exclude<RelayStatus, "idle" | "paired">,
  { label: string; dotColor: string }
> = {
  connecting: { label: "Connecting…", dotColor: "bg-text-muted" },
  joined: { label: "Waiting for extension…", dotColor: "bg-text-muted" },
  disconnected: { label: "Disconnected", dotColor: "bg-red-500" },
  error: { label: "Connection error", dotColor: "bg-red-500" },
};

// ─── Corner brackets overlay ──────────────────────────────────────────────

function CornerBrackets({ isStable }: { isStable: boolean }) {
  const color = isStable ? "#C9A85C" : "rgba(255,255,255,0.5)";
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

type CapturePhase = "ready" | "processing" | "complete" | "error";

function CameraView({
  onCapture,
  extractionPhase,
  extractionError,
  onRetake,
}: {
  onCapture: (imageData: string) => void;
  extractionPhase: "idle" | "processing" | "complete" | "error";
  extractionError: string | null;
  onRetake: () => void;
}) {
  const [localPhase, setLocalPhase] = useState<CapturePhase>("ready");
  const [flash, setFlash] = useState(false);

  const { videoRef, capture } = useCamera();

  // Drive UI phase from extractionPhase once capture has been sent
  const phase: CapturePhase =
    localPhase === "ready"
      ? "ready"
      : extractionPhase === "complete"
      ? "complete"
      : extractionPhase === "error"
      ? "error"
      : "processing";

  const handleCapture = useCallback(() => {
    const imageData = capture();
    if (!imageData) return;
    navigator.vibrate?.(100);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    onCapture(imageData);
    setLocalPhase("processing");
  }, [capture, onCapture]);

  const handleRetake = useCallback(() => {
    onRetake();
    setLocalPhase("ready");
  }, [onRetake]);

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
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "rgba(201, 168, 92, 0.3)" }}
        />
      )}

      {/* Corner-bracket guide box */}
      <div
        className="relative z-20"
        style={{ width: "72%", aspectRatio: "3/4", maxWidth: 340 }}
      >
        <CornerBrackets isStable={phase === "ready"} />

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {phase === "ready" ? "Align invoice" : ""}
          </span>
        </div>
      </div>

      {/* Capture button */}
      {phase === "ready" && (
        <div className="relative z-20 mt-8">
          <button
            onClick={handleCapture}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #C9A85C 0%, #B8923E 100%)",
              boxShadow: "0 0 24px rgba(201, 168, 92, 0.3)",
              border: "3px solid rgba(255,255,255,0.3)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.5" />
              <path d="M16.5 3H7.5L6 5.5H3.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2v-11a2 2 0 0 0-2-2H18L16.5 3z" />
            </svg>
          </button>
        </div>
      )}

      {/* Processing overlay — spinner while Claude Vision extracts */}
      {phase === "processing" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "rgba(201, 168, 92, 0.12)",
              border: "2px solid rgba(201, 168, 92, 0.3)",
            }}
          >
            <div
              className="h-10 w-10 rounded-full"
              style={{
                border: "3px solid rgba(201, 168, 92, 0.2)",
                borderTopColor: "#C9A85C",
                animation: "trakie-spin 0.9s linear infinite",
              }}
            />
          </div>
          <p className="mt-5 text-lg font-semibold" style={{ color: "#FAFAF8" }}>
            Analyzing invoice…
          </p>
          <p className="mt-1 text-sm" style={{ color: "#A8A093" }}>
            Claude Vision is reading the fields
          </p>
          <style>{`@keyframes trakie-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Complete overlay */}
      {phase === "complete" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #C9A85C 0%, #B8923E 100%)",
              boxShadow: "0 0 40px rgba(201, 168, 92, 0.4)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="mt-5 text-lg font-semibold" style={{ color: "#FAFAF8" }}>Invoice captured</p>
          <p className="mt-1 text-sm" style={{ color: "#A8A093" }}>Details sent to Trakie</p>
          <button
            onClick={handleRetake}
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(201, 168, 92, 0.3)",
              color: "#C9A85C",
            }}
          >
            Scan another
          </button>
        </div>
      )}

      {/* Error overlay */}
      {phase === "error" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 px-8">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "2px solid rgba(239, 68, 68, 0.4)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="mt-5 text-lg font-semibold" style={{ color: "#FAFAF8" }}>Extraction failed</p>
          <p className="mt-1 text-sm text-center" style={{ color: "#A8A093" }}>
            {extractionError ?? "Something went wrong. Please try again."}
          </p>
          <button
            onClick={handleRetake}
            className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(201, 168, 92, 0.3)",
              color: "#C9A85C",
            }}
          >
            Try again
          </button>
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

  const { status, sendImage, extractionPhase, extractionError, resetExtraction } =
    useRelay(sessionId);

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
    return (
      <CameraView
        onCapture={handleCapture}
        extractionPhase={extractionPhase}
        extractionError={extractionError}
        onRetake={resetExtraction}
      />
    );
  }

  // ── Connection / QR-scan view ──
  const showScanner = !sessionId;
  const nonPaired = status === "idle" || status === "paired"
    ? { label: "Connecting…", dotColor: "bg-text-muted" }
    : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const { label, dotColor } = nonPaired;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header — glass navbar */}
      <header
        className="flex items-center justify-between px-5 py-4"
        style={{
          background: "rgba(7, 7, 9, 0.8)",
          borderBottom: "1px solid rgba(201, 168, 92, 0.2)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <h1
          className="text-xl font-bold"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(135deg, #C9A85C 0%, #B8923E 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Trakie
        </h1>
        <span className="text-sm tracking-wide uppercase" style={{ color: "#A8A093", letterSpacing: "1px", fontSize: "11px" }}>
          Inventory Receiving
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        {showScanner ? (
          <div className="flex flex-col items-center gap-5">
            <p className="text-sm" style={{ color: "#A8A093" }}>
              Scan the QR code from your Trakie extension
            </p>
            <QrScanner onScan={handleScan} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Icon container — glass card */}
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(201, 168, 92, 0.2)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
              }}
            >
              <span className="text-3xl">
                {status === "paired" ? "✅" : "📦"}
              </span>
            </div>
            <h2 className="text-xl font-semibold" style={{ color: "#FAFAF8" }}>
              {status === "paired" ? "Device Paired" : "Inventory Receiving"}
            </h2>
            {/* Status pill */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(201, 168, 92, 0.2)",
              }}
            >
              <span
                className={`h-2 w-2 rounded-full ${dotColor}`}
              />
              <span className="text-sm" style={{ color: "#A8A093" }}>{label}</span>
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
        <div className="flex min-h-screen items-center justify-center bg-background" style={{ color: "#A8A093" }}>
          Loading…
        </div>
      }
    >
      <ReceiveContent />
    </Suspense>
  );
}

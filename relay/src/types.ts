import type {
  ExtractionStartedPayload,
  ExtractionFieldPayload,
  ExtractionCompletePayload,
  ExtractionErrorPayload,
} from "./extraction/types.js";

/** Events emitted by the server to clients */
export interface ServerToClientEvents {
  /** Notify that a device has paired to the session */
  "session:paired": (data: { deviceType: "extension" | "mobile" }) => void;
  /** Notify that the paired device disconnected */
  "session:device-disconnected": (data: {
    deviceType: "extension" | "mobile";
  }) => void;
  /** Relay a captured image from mobile to extension */
  "image:captured": (data: {
    sessionId: string;
    imageData: string;
    captureType: "invoice";
  }) => void;
  /** Extraction has started */
  "extraction:started": (data: ExtractionStartedPayload) => void;
  /** A single field has been parsed from the stream */
  "extraction:field": (data: ExtractionFieldPayload) => void;
  /** Extraction completed successfully */
  "extraction:complete": (data: ExtractionCompletePayload) => void;
  /** Extraction failed */
  "extraction:error": (data: ExtractionErrorPayload) => void;
  /** Generic error */
  error: (data: { message: string }) => void;
}

/** Events emitted by clients to the server */
export interface ClientToServerEvents {
  /** Join a session room by session ID */
  "session:join": (
    data: { sessionId: string; deviceType: "extension" | "mobile" },
    callback: (response: { ok: boolean; error?: string }) => void
  ) => void;
  /** Send a captured image to be relayed to the extension */
  "image:captured": (data: {
    sessionId: string;
    imageData: string;
    captureType: "invoice";
  }) => void;
}

/** Data stored on each socket */
export interface SocketData {
  sessionId: string;
  deviceType: "extension" | "mobile";
}

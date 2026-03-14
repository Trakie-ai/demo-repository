/** Events emitted by the server to clients */
export interface ServerToClientEvents {
  /** Notify that a device has paired to the session */
  "session:paired": (data: { deviceType: "extension" | "mobile" }) => void;
  /** Notify that the paired device disconnected */
  "session:device-disconnected": (data: {
    deviceType: "extension" | "mobile";
  }) => void;
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
}

/** Data stored on each socket */
export interface SocketData {
  sessionId: string;
  deviceType: "extension" | "mobile";
}

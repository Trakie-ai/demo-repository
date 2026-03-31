import QRCode from "qrcode";
import { io, type Socket } from "socket.io-client";

const RELAY_URL = process.env.RELAY_URL || "http://localhost:3001";
const MOBILE_URL = process.env.MOBILE_URL || "http://localhost:3000";

type Status = "connecting" | "waiting" | "connected" | "disconnected";

function setStatus(status: Status) {
  const dot = document.querySelector<HTMLElement>(".status-dot");
  const text = document.querySelector<HTMLElement>(".status-text");
  if (!dot || !text) return;

  const labels: Record<Status, string> = {
    connecting: "Connecting…",
    waiting: "Waiting for mobile…",
    connected: "Connected",
    disconnected: "Disconnected",
  };

  dot.className = "status-dot";
  if (status === "connected") dot.classList.add("connected");
  if (status === "waiting") dot.classList.add("waiting");
  text.textContent = labels[status];
}

async function renderQR(sessionId: string) {
  const container = document.getElementById("qr-container");
  if (!container) return;

  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const url = `${MOBILE_URL}/receive?session=${sessionId}`;
  await QRCode.toCanvas(canvas, url, {
    width: 240,
    margin: 2,
    color: {
      dark: "#C9A85C",
      light: "#070709",
    },
  });
}

function connectRelay(sessionId: string) {
  setStatus("connecting");

  const socket: Socket = io(RELAY_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  function joinSession() {
    socket.emit(
      "session:join",
      { sessionId, deviceType: "extension" as const },
      (res: { ok: boolean; error?: string }) => {
        if (res.ok) {
          setStatus("waiting");
        } else {
          console.error("[trakie] join failed:", res.error);
        }
      }
    );
  }

  socket.on("connect", () => {
    joinSession();
  });

  socket.on("session:paired", () => {
    setStatus("connected");
  });

  socket.on("session:device-disconnected", () => {
    setStatus("waiting");
  });

  socket.on(
    "image:captured",
    (data: { sessionId: string; imageData: string; captureType: string }) => {
      console.log(
        "[trakie] image received",
        data.imageData.length,
        "chars",
        `(~${Math.round(data.imageData.length * 0.75 / 1024)}KB)`
      );
    }
  );

  socket.on("disconnect", () => {
    setStatus("disconnected");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const sessionId = crypto.randomUUID();
  await renderQR(sessionId);
  connectRelay(sessionId);
});

import QRCode from "qrcode";
import { io, type Socket } from "socket.io-client";
import type { Confidence } from "./extraction-types.js";
import type {
  DutchieReceivingRecord,
  DutchieRecordWithMeta,
} from "./dutchie/types.js";
import {
  DUTCHIE_FIELD_LABELS,
  DUTCHIE_FIELD_ORDER,
} from "./dutchie/types.js";
import {
  applyFieldToRecord,
  emptyDutchieRecord,
} from "./dutchie/mapper.js";

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

// ─── Extraction panel ──────────────────────────────────────────────────────

const lineItemRecords: DutchieRecordWithMeta[] = [];

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function setExtractionStatus(text: string, mode: "normal" | "complete" | "error" = "normal") {
  const el = document.getElementById("extraction-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("is-complete", "is-error");
  if (mode === "complete") el.classList.add("is-complete");
  if (mode === "error") el.classList.add("is-error");
}

function showExtractionPanel() {
  const panel = document.getElementById("extraction-panel");
  if (panel) panel.hidden = false;
}

function resetExtractionPanel() {
  lineItemRecords.length = 0;
  const list = document.getElementById("line-items");
  if (list) list.innerHTML = "";
  setExtractionStatus("Extracting…");
}

function ensureLineItemSlot(index: number): DutchieRecordWithMeta {
  while (lineItemRecords.length <= index) {
    lineItemRecords.push(emptyDutchieRecord());
    const list = document.getElementById("line-items");
    if (list) {
      const idx = lineItemRecords.length - 1;
      const li = document.createElement("li");
      li.className = "line-item";
      li.id = `line-item-${idx}`;
      const header = document.createElement("div");
      header.className = "line-item-header";
      header.textContent = `Line item ${idx + 1}`;
      li.appendChild(header);
      list.appendChild(li);
    }
  }
  return lineItemRecords[index];
}

function renderField(
  lineItemIndex: number,
  fieldName: string,
  value: string | number | null,
  confidence: Confidence
) {
  const record = ensureLineItemSlot(lineItemIndex);
  applyFieldToRecord(record, fieldName, value, confidence);

  if (!(fieldName in DUTCHIE_FIELD_LABELS)) return;
  const key = fieldName as keyof DutchieReceivingRecord;

  const itemEl = document.getElementById(`line-item-${lineItemIndex}`);
  if (!itemEl) return;

  const rowId = `field-${lineItemIndex}-${fieldName}`;
  let row = document.getElementById(rowId);
  if (!row) {
    row = document.createElement("div");
    row.className = "field-row";
    row.id = rowId;

    const dot = document.createElement("span");
    dot.className = "confidence-dot";
    row.appendChild(dot);

    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = DUTCHIE_FIELD_LABELS[key];
    row.appendChild(label);

    const valueEl = document.createElement("span");
    valueEl.className = "field-value";
    row.appendChild(valueEl);

    // Insert in canonical field order so fields stay sorted even when they
    // arrive from Claude in a different order.
    const siblings = Array.from(itemEl.querySelectorAll<HTMLElement>(".field-row"));
    const keyOrder = DUTCHIE_FIELD_ORDER.indexOf(key);
    const insertBefore = siblings.find((sib) => {
      const sibKey = sib.id.split("-").slice(2).join("-");
      return (
        DUTCHIE_FIELD_ORDER.indexOf(sibKey as keyof DutchieReceivingRecord) > keyOrder
      );
    });
    if (insertBefore) {
      itemEl.insertBefore(row, insertBefore);
    } else {
      itemEl.appendChild(row);
    }
  }

  const dot = row.querySelector<HTMLElement>(".confidence-dot");
  if (dot) {
    dot.className = `confidence-dot confidence-${confidence}`;
  }

  const valueEl = row.querySelector<HTMLElement>(".field-value");
  if (valueEl) {
    const formatted = formatValue(value);
    valueEl.textContent = formatted;
    valueEl.classList.toggle("is-null", formatted === "—");
  }
}

// ─── Socket ───────────────────────────────────────────────────────────────

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

  socket.on("extraction:started", () => {
    showExtractionPanel();
    resetExtractionPanel();
  });

  socket.on(
    "extraction:field",
    (data: {
      sessionId: string;
      lineItemIndex: number;
      fieldName: string;
      value: string | number | null;
      confidence: Confidence;
    }) => {
      showExtractionPanel();
      renderField(data.lineItemIndex, data.fieldName, data.value, data.confidence);
    }
  );

  socket.on(
    "extraction:complete",
    (data: { sessionId: string; extraction: { lineItems: unknown[] } }) => {
      const count = data.extraction?.lineItems?.length ?? 0;
      setExtractionStatus(`Complete · ${count} item${count === 1 ? "" : "s"}`, "complete");
    }
  );

  socket.on(
    "extraction:error",
    (data: { sessionId: string; error: string }) => {
      showExtractionPanel();
      setExtractionStatus(`Error: ${data.error}`, "error");
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

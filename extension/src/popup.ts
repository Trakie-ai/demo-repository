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

type CaptureGroup = {
  id: string;
  captureType: "invoice" | "label";
  labelIndex?: number;
  records: DutchieRecordWithMeta[];
  listEl: HTMLOListElement;
  statusEl: HTMLElement;
};

let groups: CaptureGroup[] = [];
let currentGroup: CaptureGroup | null = null;
let groupCounter = 0;
let labelCounter = 0;

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function showExtractionPanel() {
  const panel = document.getElementById("extraction-panel");
  if (panel) panel.hidden = false;
}

function resetExtractionPanel() {
  groups = [];
  currentGroup = null;
  groupCounter = 0;
  labelCounter = 0;
  const list = document.getElementById("line-items");
  if (list) list.innerHTML = "";
  const banner = document.getElementById("session-banner");
  if (banner) banner.hidden = true;
}

function startCaptureGroup(captureType: "invoice" | "label"): CaptureGroup {
  groupCounter++;
  let labelIndex: number | undefined;
  let titleText: string;
  if (captureType === "invoice") {
    titleText = "Invoice";
  } else {
    labelCounter++;
    labelIndex = labelCounter;
    titleText = `Label ${labelCounter}`;
  }

  const list = document.getElementById("line-items") as HTMLOListElement | null;
  if (!list) throw new Error("extraction list container missing");

  const groupEl = document.createElement("li");
  groupEl.className = `capture-group capture-group--${captureType}`;
  groupEl.id = `capture-group-${groupCounter}`;

  const header = document.createElement("div");
  header.className = "group-header";

  const title = document.createElement("span");
  title.className = "group-title";
  title.textContent = titleText;
  header.appendChild(title);

  const statusEl = document.createElement("span");
  statusEl.className = "group-status";
  statusEl.textContent = "Extracting…";
  header.appendChild(statusEl);

  groupEl.appendChild(header);

  const groupList = document.createElement("ol");
  groupList.className = "group-items";
  groupEl.appendChild(groupList);

  list.appendChild(groupEl);

  const group: CaptureGroup = {
    id: groupEl.id,
    captureType,
    labelIndex,
    records: [],
    listEl: groupList,
    statusEl,
  };

  groups.push(group);
  currentGroup = group;
  return group;
}

function ensureLineItemSlot(group: CaptureGroup, index: number): DutchieRecordWithMeta {
  while (group.records.length <= index) {
    group.records.push(emptyDutchieRecord());
    const idx = group.records.length - 1;
    const li = document.createElement("li");
    li.className = "line-item";
    li.id = `${group.id}-item-${idx}`;
    const header = document.createElement("div");
    header.className = "line-item-header";
    header.textContent = `Line item ${idx + 1}`;
    li.appendChild(header);
    group.listEl.appendChild(li);
  }
  return group.records[index];
}

function renderField(
  lineItemIndex: number,
  fieldName: string,
  value: string | number | null,
  confidence: Confidence
) {
  if (!currentGroup) {
    // No captureType context yet — seed a fallback invoice group so fields
    // aren't dropped. This should only happen if events arrive before
    // image:captured (shouldn't with current relay ordering).
    startCaptureGroup("invoice");
  }
  const group = currentGroup!;
  const record = ensureLineItemSlot(group, lineItemIndex);
  applyFieldToRecord(record, fieldName, value, confidence);

  if (!(fieldName in DUTCHIE_FIELD_LABELS)) return;
  const key = fieldName as keyof DutchieReceivingRecord;

  const itemEl = document.getElementById(`${group.id}-item-${lineItemIndex}`);
  if (!itemEl) return;

  const rowId = `${group.id}-field-${lineItemIndex}-${fieldName}`;
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
      const parts = sib.id.split("-field-")[1]?.split("-") ?? [];
      const sibKey = parts.slice(1).join("-");
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

function setGroupStatus(
  group: CaptureGroup,
  text: string,
  mode: "normal" | "complete" | "error" = "normal"
) {
  group.statusEl.textContent = text;
  group.statusEl.classList.remove("is-complete", "is-error");
  if (mode === "complete") group.statusEl.classList.add("is-complete");
  if (mode === "error") group.statusEl.classList.add("is-error");
}

function showSessionBanner(invoiceCount: number, labelCount: number) {
  const banner = document.getElementById("session-banner");
  if (!banner) return;
  const label = document.getElementById("session-banner-text");
  if (label) {
    const parts: string[] = [];
    if (invoiceCount > 0) parts.push(`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}`);
    parts.push(`${labelCount} label${labelCount === 1 ? "" : "s"}`);
    label.textContent = `Session complete · ${parts.join(" + ")}`;
  }
  banner.hidden = false;
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
    (data: { sessionId: string; imageData: string; captureType: "invoice" | "label" }) => {
      const kb = Math.round((data.imageData.length * 0.75) / 1024);
      console.log(`[trakie] ${data.captureType} image received: ~${kb}KB`);
      showExtractionPanel();
      startCaptureGroup(data.captureType);
    }
  );

  socket.on("extraction:started", () => {
    showExtractionPanel();
    if (currentGroup) setGroupStatus(currentGroup, "Extracting…");
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
      if (currentGroup) {
        setGroupStatus(
          currentGroup,
          `Complete · ${count} item${count === 1 ? "" : "s"}`,
          "complete"
        );
      }
    }
  );

  socket.on(
    "extraction:error",
    (data: { sessionId: string; error: string }) => {
      showExtractionPanel();
      if (currentGroup) setGroupStatus(currentGroup, `Error: ${data.error}`, "error");
    }
  );

  socket.on(
    "session:complete",
    (data: { sessionId: string; invoiceCount: number; labelCount: number }) => {
      showSessionBanner(data.invoiceCount, data.labelCount);
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

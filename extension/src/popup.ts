import QRCode from "qrcode";
import { io, type Socket } from "socket.io-client";
import type { Confidence } from "./extraction-types.js";
import type {
  DutchieReceivingRecord,
  DutchieRecordWithMeta,
} from "./dutchie/types.js";
import { DUTCHIE_FIELD_LABELS } from "./dutchie/types.js";
import { applyFieldToRecord, emptyDutchieRecord } from "./dutchie/mapper.js";
import { CATEGORY_BY_FIELD, DUTCHIE_CATEGORIES } from "./dutchie/categories.js";

const RELAY_URL = process.env.RELAY_URL || "http://localhost:3001";
const MOBILE_URL = process.env.MOBILE_URL || "http://localhost:3000";

type Status = "connecting" | "waiting" | "connected" | "disconnected";

// ─── Top bar + view toggle ────────────────────────────────────────────────

function setStatus(status: Status) {
  const pill = document.getElementById("status-pill");
  const text = pill?.querySelector<HTMLElement>(".status-text");
  if (!pill || !text) return;

  const labels: Record<Status, string> = {
    connecting: "Connecting…",
    waiting: "Waiting for mobile…",
    connected: "Connected",
    disconnected: "Disconnected",
  };

  pill.dataset.status = status;
  text.textContent = labels[status];

  const connecting = document.getElementById("connecting-view");
  const live = document.getElementById("live-view");
  if (!connecting || !live) return;

  if (status === "connected") {
    connecting.hidden = true;
    live.hidden = false;
  } else {
    // connecting / waiting / disconnected: show QR. Keep existing capture
    // sections mounted so if the mobile reconnects we don't lose state.
    connecting.hidden = false;
    // leave live hidden unless we already had captures
    if (groups.length === 0) {
      live.hidden = true;
    }
  }
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
      dark: "#4ade80",
      light: "#0A1410",
    },
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────

type BadgeMode = "waiting" | "extracting" | "complete" | "session";

function updateStatusBadge() {
  const badge = document.getElementById("status-badge");
  const label = document.getElementById("status-badge-label");
  const count = document.getElementById("status-badge-count");
  if (!badge || !label || !count) return;

  if (sessionCompleted) {
    badge.dataset.mode = "session" satisfies BadgeMode;
    label.textContent = "SESSION COMPLETE";
    count.textContent = totalItemLabel();
    return;
  }

  if (groups.length === 0) {
    badge.dataset.mode = "waiting" satisfies BadgeMode;
    label.textContent = "WAITING FOR CAPTURE";
    count.textContent = "";
    return;
  }

  const anyExtracting = groups.some((g) => g.status === "extracting");
  if (anyExtracting) {
    badge.dataset.mode = "extracting" satisfies BadgeMode;
    label.textContent = "EXTRACTING…";
    count.textContent = totalItemLabel();
    return;
  }

  badge.dataset.mode = "complete" satisfies BadgeMode;
  label.textContent = "EXTRACTION COMPLETE";
  count.textContent = totalItemLabel();
}

function totalItemCount(): number {
  return groups.reduce((sum, g) => sum + g.records.length, 0);
}

function totalItemLabel(): string {
  const n = totalItemCount();
  return `${n} ITEM${n === 1 ? "" : "S"}`;
}

// ─── Capture group model ──────────────────────────────────────────────────

type CaptureGroup = {
  id: string;
  captureType: "invoice" | "label";
  labelIndex?: number;
  records: DutchieRecordWithMeta[];
  sectionEl: HTMLElement;
  itemsEl: HTMLElement;
  status: "extracting" | "complete" | "error";
};

let groups: CaptureGroup[] = [];
let currentGroup: CaptureGroup | null = null;
let groupCounter = 0;
let labelCounter = 0;
let sessionCompleted = false;

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function resetLiveView() {
  groups = [];
  currentGroup = null;
  groupCounter = 0;
  labelCounter = 0;
  sessionCompleted = false;
  const list = document.getElementById("capture-list");
  if (list) list.innerHTML = "";
  updateStatusBadge();
}

function showLiveView() {
  const live = document.getElementById("live-view");
  if (live) live.hidden = false;
}

function startCaptureGroup(captureType: "invoice" | "label"): CaptureGroup {
  groupCounter++;
  let labelIndex: number | undefined;
  let heading: string;
  if (captureType === "invoice") {
    heading = "Invoice";
  } else {
    labelCounter++;
    labelIndex = labelCounter;
    heading = `Label ${labelCounter}`;
  }

  const list = document.getElementById("capture-list") as HTMLOListElement | null;
  if (!list) throw new Error("capture-list missing");

  const sectionEl = document.createElement("li");
  sectionEl.className = `capture-section capture-section--${captureType}`;
  sectionEl.id = `capture-group-${groupCounter}`;

  const headingEl = document.createElement("div");
  headingEl.className = "capture-heading";
  const headingText = document.createElement("span");
  headingText.textContent = heading;
  headingEl.appendChild(headingText);
  const statusEl = document.createElement("span");
  statusEl.className = "capture-status";
  statusEl.textContent = "Extracting…";
  headingEl.appendChild(statusEl);
  sectionEl.appendChild(headingEl);

  const itemsEl = document.createElement("div");
  itemsEl.className = "capture-items";
  sectionEl.appendChild(itemsEl);

  list.appendChild(sectionEl);

  const group: CaptureGroup = {
    id: sectionEl.id,
    captureType,
    labelIndex,
    records: [],
    sectionEl,
    itemsEl,
    status: "extracting",
  };

  groups.push(group);
  currentGroup = group;
  updateStatusBadge();
  return group;
}

function setGroupStatus(
  group: CaptureGroup,
  status: "extracting" | "complete" | "error",
  message?: string
) {
  group.status = status;
  const statusEl = group.sectionEl.querySelector<HTMLElement>(".capture-status");
  if (statusEl) {
    statusEl.classList.remove("is-complete", "is-error");
    if (status === "complete") {
      statusEl.classList.add("is-complete");
      statusEl.textContent = message ?? `Complete · ${group.records.length} item${group.records.length === 1 ? "" : "s"}`;
    } else if (status === "error") {
      statusEl.classList.add("is-error");
      statusEl.textContent = message ?? "Error";
    } else {
      statusEl.textContent = message ?? "Extracting…";
    }
  }
  updateStatusBadge();
}

function showCaptureError(group: CaptureGroup, message: string) {
  let errEl = group.sectionEl.querySelector<HTMLElement>(".capture-error");
  if (!errEl) {
    errEl = document.createElement("div");
    errEl.className = "capture-error";
    group.sectionEl.appendChild(errEl);
  }
  errEl.textContent = message;
}

function ensureLineItem(
  group: CaptureGroup,
  index: number
): { record: DutchieRecordWithMeta; itemEl: HTMLElement } {
  while (group.records.length <= index) {
    group.records.push(emptyDutchieRecord());
    const idx = group.records.length - 1;

    const itemEl = document.createElement("div");
    itemEl.className = "line-item";
    itemEl.id = `${group.id}-item-${idx}`;

    // For multi-item captures (invoices with >1 line item), show a divider
    // labeling each subsequent line item. First item has no divider.
    if (idx > 0) {
      const divider = document.createElement("div");
      divider.className = "line-item-divider";
      divider.textContent = `Line item ${idx + 1}`;
      itemEl.appendChild(divider);
    }

    group.itemsEl.appendChild(itemEl);
    updateStatusBadge();
  }
  const itemEl = document.getElementById(`${group.id}-item-${index}`);
  if (!itemEl) throw new Error("line item DOM missing");
  return { record: group.records[index], itemEl };
}

function ensureCategoryBlock(
  group: CaptureGroup,
  lineItemIndex: number,
  categoryId: string,
  categoryLabel: string
): HTMLElement {
  const blockId = `${group.id}-item-${lineItemIndex}-cat-${categoryId}`;
  let block = document.getElementById(blockId);
  if (block) {
    const fields = block.querySelector<HTMLElement>(".category-fields");
    if (!fields) throw new Error("category-fields missing in existing block");
    return fields;
  }

  const { itemEl } = ensureLineItem(group, lineItemIndex);

  block = document.createElement("div");
  block.className = "category-block";
  block.id = blockId;
  block.dataset.categoryId = categoryId;

  const heading = document.createElement("div");
  heading.className = "category-heading";
  heading.textContent = categoryLabel.toUpperCase();
  block.appendChild(heading);

  const fields = document.createElement("div");
  fields.className = "category-fields";
  block.appendChild(fields);

  // Insert in canonical category order so blocks stay sorted even when fields
  // from later categories arrive first in the stream.
  const targetOrder = DUTCHIE_CATEGORIES.findIndex((c) => c.id === categoryId);
  const siblings = Array.from(
    itemEl.querySelectorAll<HTMLElement>(":scope > .category-block")
  );
  const insertBefore = siblings.find((sib) => {
    const sibId = sib.dataset.categoryId;
    const sibOrder = DUTCHIE_CATEGORIES.findIndex((c) => c.id === sibId);
    return sibOrder > targetOrder;
  });
  if (insertBefore) {
    itemEl.insertBefore(block, insertBefore);
  } else {
    itemEl.appendChild(block);
  }

  return fields;
}

function renderField(
  lineItemIndex: number,
  fieldName: string,
  value: string | number | null,
  confidence: Confidence
) {
  if (!currentGroup) {
    // Defensive: start an invoice group if somehow a field arrives before
    // image:captured. Current relay ordering guarantees image:captured first,
    // so this is a belt-and-suspenders path.
    startCaptureGroup("invoice");
  }
  const group = currentGroup!;
  const { record } = ensureLineItem(group, lineItemIndex);
  applyFieldToRecord(record, fieldName, value, confidence);

  if (!(fieldName in DUTCHIE_FIELD_LABELS)) return;
  const key = fieldName as keyof DutchieReceivingRecord;
  const category = CATEGORY_BY_FIELD.get(key);
  if (!category) return; // ingredients/allergens etc. — stored but not shown

  const fieldsContainer = ensureCategoryBlock(
    group,
    lineItemIndex,
    category.id,
    category.label
  );

  const rowId = `${group.id}-item-${lineItemIndex}-field-${fieldName}`;
  let row = document.getElementById(rowId);
  if (!row) {
    row = document.createElement("div");
    row.className = "field-card";
    row.id = rowId;
    row.dataset.fieldName = fieldName;

    const dot = document.createElement("span");
    dot.className = "confidence-dot";
    row.appendChild(dot);

    const body = document.createElement("div");
    body.className = "field-body";
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = DUTCHIE_FIELD_LABELS[key].toUpperCase();
    body.appendChild(label);
    const valueEl = document.createElement("span");
    valueEl.className = "field-value";
    body.appendChild(valueEl);
    row.appendChild(body);

    // Insert in the category's canonical field order
    const siblings = Array.from(
      fieldsContainer.querySelectorAll<HTMLElement>(":scope > .field-card")
    );
    const keyOrder = category.fields.indexOf(key);
    const insertBefore = siblings.find((sib) => {
      const sibKey = sib.dataset.fieldName as keyof DutchieReceivingRecord | undefined;
      if (!sibKey) return false;
      return category.fields.indexOf(sibKey) > keyOrder;
    });
    if (insertBefore) {
      fieldsContainer.insertBefore(row, insertBefore);
    } else {
      fieldsContainer.appendChild(row);
    }
  }

  const dot = row.querySelector<HTMLElement>(".confidence-dot");
  if (dot) dot.className = `confidence-dot confidence-${confidence}`;

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
    showLiveView();
    updateStatusBadge();
  });

  socket.on("session:device-disconnected", () => {
    setStatus("waiting");
  });

  socket.on(
    "image:captured",
    (data: { sessionId: string; imageData: string; captureType: "invoice" | "label" }) => {
      const kb = Math.round((data.imageData.length * 0.75) / 1024);
      console.log(`[trakie] ${data.captureType} image received: ~${kb}KB`);
      showLiveView();
      startCaptureGroup(data.captureType);
    }
  );

  socket.on("extraction:started", () => {
    showLiveView();
    if (currentGroup) setGroupStatus(currentGroup, "extracting");
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
      showLiveView();
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
          "complete",
          `Complete · ${count} item${count === 1 ? "" : "s"}`
        );
      }
    }
  );

  socket.on(
    "extraction:error",
    (data: { sessionId: string; error: string }) => {
      showLiveView();
      if (currentGroup) {
        setGroupStatus(currentGroup, "error", `Error: ${data.error}`);
        showCaptureError(currentGroup, data.error);
      }
    }
  );

  socket.on(
    "session:complete",
    (_data: { sessionId: string; invoiceCount: number; labelCount: number }) => {
      sessionCompleted = true;
      updateStatusBadge();
    }
  );

  socket.on("disconnect", () => {
    setStatus("disconnected");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const sessionId = crypto.randomUUID();
  await renderQR(sessionId);
  resetLiveView();
  connectRelay(sessionId);
});

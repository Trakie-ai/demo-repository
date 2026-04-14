import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, EXTRACT_TOOL } from "./prompt.js";
import type {
  Confidence,
  ExtractionFieldPayload,
  ExtractionResponse,
  ExtractionResult,
} from "./types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

/**
 * Strip data URL prefix if present, returning raw base64.
 * Handles both "data:image/jpeg;base64,..." and plain base64 strings.
 */
function stripDataUrl(imageData: string): string {
  const commaIndex = imageData.indexOf(",");
  if (commaIndex !== -1 && imageData.startsWith("data:")) {
    return imageData.slice(commaIndex + 1);
  }
  return imageData;
}

const VALID_CONFIDENCES: ReadonlySet<Confidence> = new Set([
  "green",
  "yellow",
  "red",
]);

function isCompleteField(
  candidate: unknown
): candidate is { value: string | number | null; confidence: Confidence } {
  if (!candidate || typeof candidate !== "object") return false;
  const obj = candidate as Record<string, unknown>;
  if (!("value" in obj) || !("confidence" in obj)) return false;
  if (typeof obj.confidence !== "string") return false;
  return VALID_CONFIDENCES.has(obj.confidence as Confidence);
}

export interface StreamCallbacks {
  onField?: (field: Omit<ExtractionFieldPayload, "sessionId">) => void;
}

/**
 * Extract structured invoice data from a base64 JPEG image using Claude Vision,
 * streaming each completed field to `onField` as soon as it is parsed.
 */
export async function extractInvoiceDataStreaming(
  imageData: string,
  callbacks: StreamCallbacks = {}
): Promise<ExtractionResponse> {
  const anthropic = getClient();
  const base64 = stripDataUrl(imageData);

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_invoice_data" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract all line items from this cannabis invoice. For each field, provide the value and a confidence level (green/yellow/red).",
          },
        ],
      },
    ],
  });

  const seen = new Set<string>();

  stream.on("inputJson", (_partialJson, snapshot) => {
    if (!callbacks.onField) return;
    if (!snapshot || typeof snapshot !== "object") return;
    const s = snapshot as { lineItems?: unknown };
    if (!Array.isArray(s.lineItems)) return;

    for (let i = 0; i < s.lineItems.length; i++) {
      const item = s.lineItems[i];
      if (!item || typeof item !== "object") continue;
      const fields = item as Record<string, unknown>;

      for (const key of Object.keys(fields)) {
        const field = fields[key];
        if (!isCompleteField(field)) continue;

        const marker = `${i}.${key}`;
        if (seen.has(marker)) continue;
        seen.add(marker);

        callbacks.onField({
          lineItemIndex: i,
          fieldName: key as keyof ExtractionResult,
          value: field.value,
          confidence: field.confidence,
        });
      }
    }
  });

  const finalMessage = await stream.finalMessage();

  const toolBlock = finalMessage.content.find(
    (block) => block.type === "tool_use"
  );
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const input = toolBlock.input as Record<string, unknown>;
  if (!input || !Array.isArray(input.lineItems)) {
    console.error(
      "[extraction] unexpected response shape:",
      JSON.stringify(input, null, 2)
    );
    throw new Error(
      "Claude returned unexpected response shape — missing lineItems array"
    );
  }

  return input as unknown as ExtractionResponse;
}

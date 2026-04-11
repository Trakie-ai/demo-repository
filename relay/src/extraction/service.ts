import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, EXTRACT_TOOL } from "./prompt.js";
import type { ExtractionResponse } from "./types.js";

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

/**
 * Extract structured invoice data from a base64 JPEG image using Claude Vision.
 */
export async function extractInvoiceData(
  imageData: string
): Promise<ExtractionResponse> {
  const anthropic = getClient();
  const base64 = stripDataUrl(imageData);

  const response = await anthropic.messages.create({
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

  const toolBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  return toolBlock.input as ExtractionResponse;
}

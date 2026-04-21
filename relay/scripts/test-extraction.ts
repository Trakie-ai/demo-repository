import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractInvoiceDataStreaming } from "../src/extraction/index.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npx tsx scripts/test-extraction.ts <path-to-invoice.jpg>");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set. Add it to relay/.env");
  process.exit(1);
}

const absPath = resolve(filePath);
const buffer = readFileSync(absPath);
const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

console.log(`Extracting from: ${absPath}`);
console.log(`Image size: ${(buffer.length / 1024).toFixed(1)} KB`);
console.log("---");

const start = Date.now();

function flag(confidence: string): string {
  return confidence === "green" ? "G" : "R";
}

extractInvoiceDataStreaming(base64, {
  onField: (field) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[${elapsed}s] [${flag(field.confidence)}] line ${field.lineItemIndex} · ${field.fieldName}: ${field.value ?? "(null)"}`
    );
  },
})
  .then((result) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n--- Stream complete in ${elapsed}s ---`);
    console.log(`Line items: ${result.lineItems.length}`);
    if (result.notes) {
      console.log(`Notes: ${result.notes}`);
    }
  })
  .catch((err) => {
    console.error("Extraction failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });

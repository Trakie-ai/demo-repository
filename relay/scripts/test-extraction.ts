import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractInvoiceData } from "../src/extraction/index.js";

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

extractInvoiceData(base64)
  .then((result) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Extraction completed in ${elapsed}s\n`);

    console.log(`Line items: ${result.lineItems.length}`);
    if (result.notes) {
      console.log(`Notes: ${result.notes}`);
    }
    console.log("");

    for (const [i, item] of result.lineItems.entries()) {
      console.log(`--- Line Item ${i + 1} ---`);
      for (const [key, field] of Object.entries(item)) {
        const { value, confidence } = field as { value: unknown; confidence: string };
        const flag =
          confidence === "green" ? "G" : confidence === "yellow" ? "Y" : "R";
        console.log(`  [${flag}] ${key}: ${value ?? "(null)"}`);
      }
      console.log("");
    }
  })
  .catch((err) => {
    console.error("Extraction failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });

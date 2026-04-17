# Label-Specific Extraction Prompt

## Goal

Today, `image:captured` payloads with `captureType: "label"` go through the same Claude Vision prompt/tool as invoices (see `relay/src/extraction/service.ts`, `relay/src/extraction/prompt.ts`). The prompt is written for invoices, where a single image contains many line items. A product label is a single item with much richer per-SKU detail (ingredients, allergens, THC/CBD, METRC tag, batch/lot, expiration).

Reusing the invoice prompt works but wastes tokens and confuses Claude into pattern-matching "line items" when there is only one.

## What changes

1. **Branch on `captureType` in the relay handler.** In `relay/src/index.ts`, route to one of two extractors:
   - `extractInvoiceDataStreaming` (existing)
   - `extractLabelDataStreaming` (new)
2. **New label prompt.** Focused on a single product with all compliance fields. Explicit about:
   - Always return exactly one `lineItems[0]`.
   - Prioritize fields commonly on labels: `productName`, `brand`, `thc`, `cbd`, `netWeightOrUnitCount`, `batchLotNumber`, `expirationDate`, `packageIdMetrcTag`, `ingredients`, `allergens`.
   - Skip fields that don't appear on labels (vendor, wholesale cost) unless explicitly present.
3. **Optional: tighter tool schema.** The existing `extract_invoice_data` tool schema is generic. Could add a `extract_label_data` tool that omits vendor/cost fields, but that'd mean two different `ExtractionResult` shapes — extra type plumbing. Probably not worth it; reuse the same schema, just with different system prompt guidance.

## Why we haven't done it yet

Sprint W4 explicitly chose "same extraction as invoice" to keep scope tight. The user confirmed this. The current behavior works — just noisy.

## Trigger for doing it

- Labels extract with visibly lower quality than invoices (fields missing, wrong confidence).
- Token cost becomes material.
- We want extraction notes specific to label features (e.g., pull 2D barcode tag IDs, COA references).

## Implementation cost

Small:
- One new file `relay/src/extraction/label-prompt.ts` (~1 prompt, 1 exported constant).
- ~10 lines in `service.ts` for the new extractor function (or parameterize the existing one with a prompt argument).
- ~5 lines in `index.ts` to branch.
- No mobile / extension changes — they consume the same event shape.

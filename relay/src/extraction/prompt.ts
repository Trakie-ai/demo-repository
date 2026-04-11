import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";

export const SYSTEM_PROMPT = `You are a cannabis invoice data extraction specialist. Your job is to extract structured product data from invoice images.

RULES:
1. Extract every visible line item from the invoice.
2. For each field, assign a confidence level:
   - "green": clearly legible and unambiguous
   - "yellow": partially legible, inferred from context, or slightly uncertain
   - "red": not visible, illegible, or cannot be determined — set value to null
3. THC and CBD values MUST be copied exactly as printed (e.g. "23.5%", "100mg", "<LOQ"). Never convert units or round.
4. Never fabricate data. If a field is not on the invoice, mark it red with null.
5. For category, use one of: Flower, Pre-Roll, Vape, Edible, Concentrate, Topical, Tincture, Capsule, Accessory, Other.
6. For subcategory, use the most specific descriptor visible (e.g. "Indica", "Sativa", "Hybrid", "Gummy", "Cartridge").
7. Prices should be numeric (no currency symbols). If a price shows "$12.50", extract as 12.50.
8. If the invoice contains header-level info (vendor name) that applies to all line items, copy it to each line item.
9. If the image is blurry, rotated, or partially cut off, extract what you can and note issues in the "notes" field.`;

const fieldSchema = (description: string, type: "string" | "number") => ({
  type: "object" as const,
  properties: {
    value: type === "string"
      ? { type: ["string", "null"] as const, description }
      : { type: ["number", "null"] as const, description },
    confidence: {
      type: "string" as const,
      enum: ["green", "yellow", "red"],
      description: "green = clearly legible, yellow = uncertain, red = not visible/null",
    },
  },
  required: ["value", "confidence"],
});

const lineItemSchema = {
  type: "object" as const,
  properties: {
    productName: fieldSchema("Product name as printed on invoice", "string"),
    brand: fieldSchema("Brand or manufacturer name", "string"),
    category: fieldSchema("Product category: Flower, Pre-Roll, Vape, Edible, Concentrate, Topical, Tincture, Capsule, Accessory, or Other", "string"),
    subcategory: fieldSchema("Subcategory or strain type (e.g. Indica, Sativa, Hybrid, Gummy, Cartridge)", "string"),
    thc: fieldSchema("THC content exactly as printed (e.g. '23.5%', '100mg')", "string"),
    cbd: fieldSchema("CBD content exactly as printed (e.g. '5.0%', '50mg')", "string"),
    netWeightOrUnitCount: fieldSchema("Net weight or unit count as printed (e.g. '3.5g', '10pk')", "string"),
    batchLotNumber: fieldSchema("Batch or lot number", "string"),
    expirationDate: fieldSchema("Expiration date as printed", "string"),
    packageIdMetrcTag: fieldSchema("Package ID or METRC tag number", "string"),
    wholesaleCostPerUnit: fieldSchema("Wholesale cost per unit (numeric, no currency symbol)", "number"),
    retailPrice: fieldSchema("Retail/suggested price (numeric, no currency symbol)", "number"),
    ingredients: fieldSchema("Ingredients list if visible", "string"),
    allergens: fieldSchema("Allergen information if visible", "string"),
    vendorName: fieldSchema("Vendor or distributor name", "string"),
    quantityReceived: fieldSchema("Quantity received (numeric)", "number"),
  },
  required: [
    "productName", "brand", "category", "subcategory",
    "thc", "cbd", "netWeightOrUnitCount", "batchLotNumber",
    "expirationDate", "packageIdMetrcTag",
    "wholesaleCostPerUnit", "retailPrice",
    "ingredients", "allergens",
    "vendorName", "quantityReceived",
  ],
};

export const EXTRACT_TOOL: Tool = {
  name: "extract_invoice_data",
  description: "Extract structured product data from a cannabis invoice image. Returns all line items with confidence levels.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        items: lineItemSchema,
        description: "Array of extracted line items from the invoice",
      },
      notes: {
        type: ["string", "null"],
        description: "Optional notes about image quality, missing data, or extraction issues",
      },
    },
    required: ["lineItems", "notes"],
  },
};

/** Confidence level for an extracted field */
export type Confidence = "green" | "red";

/** A single extracted field with its value and confidence */
export interface ExtractedField<T> {
  value: T | null;
  confidence: Confidence;
}

/** Structured extraction result for one invoice line item (PRD Section 5) */
export interface ExtractionResult {
  // Product Identity
  productName: ExtractedField<string>;
  brand: ExtractedField<string>;
  category: ExtractedField<string>;
  subcategory: ExtractedField<string>;

  // Compliance
  thc: ExtractedField<string>;
  cbd: ExtractedField<string>;
  netWeightOrUnitCount: ExtractedField<string>;
  batchLotNumber: ExtractedField<string>;
  expirationDate: ExtractedField<string>;
  packageIdMetrcTag: ExtractedField<string>;

  // Pricing
  wholesaleCostPerUnit: ExtractedField<number>;
  retailPrice: ExtractedField<number>;

  // Details
  ingredients: ExtractedField<string>;
  allergens: ExtractedField<string>;

  // Receiving
  vendorName: ExtractedField<string>;
  quantityReceived: ExtractedField<number>;
}

/** Full extraction response from Claude Vision */
export interface ExtractionResponse {
  lineItems: ExtractionResult[];
  notes: string | null;
}

/** Socket.IO payload emitted when extraction begins */
export interface ExtractionStartedPayload {
  sessionId: string;
  startedAt: string;
}

/** Socket.IO payload emitted for each field as it is parsed from the stream */
export interface ExtractionFieldPayload {
  sessionId: string;
  lineItemIndex: number;
  fieldName: keyof ExtractionResult;
  value: string | number | null;
  confidence: Confidence;
}

/** Socket.IO payload for successful extraction */
export interface ExtractionCompletePayload {
  sessionId: string;
  extraction: ExtractionResponse;
  completedAt: string;
}

/** Socket.IO payload for extraction failure */
export interface ExtractionErrorPayload {
  sessionId: string;
  error: string;
  failedAt: string;
}

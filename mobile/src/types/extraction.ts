export type Confidence = "green" | "yellow" | "red";

export interface ExtractedField<T> {
  value: T | null;
  confidence: Confidence;
}

export interface ExtractionResult {
  productName: ExtractedField<string>;
  brand: ExtractedField<string>;
  category: ExtractedField<string>;
  subcategory: ExtractedField<string>;

  thc: ExtractedField<string>;
  cbd: ExtractedField<string>;
  netWeightOrUnitCount: ExtractedField<string>;
  batchLotNumber: ExtractedField<string>;
  expirationDate: ExtractedField<string>;
  packageIdMetrcTag: ExtractedField<string>;

  wholesaleCostPerUnit: ExtractedField<number>;
  retailPrice: ExtractedField<number>;

  ingredients: ExtractedField<string>;
  allergens: ExtractedField<string>;

  vendorName: ExtractedField<string>;
  quantityReceived: ExtractedField<number>;
}

export interface ExtractionResponse {
  lineItems: ExtractionResult[];
  notes: string | null;
}

import type { Confidence } from "../extraction-types.js";

export interface DutchieReceivingRecord {
  productName: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  thc: string | null;
  cbd: string | null;
  netWeightOrUnitCount: string | null;
  batchLotNumber: string | null;
  expirationDate: string | null;
  packageIdMetrcTag: string | null;
  wholesaleCostPerUnit: number | null;
  retailPrice: number | null;
  ingredients: string | null;
  allergens: string | null;
  vendorName: string | null;
  quantityReceived: number | null;
}

export interface DutchieFieldMeta {
  confidence: Confidence;
  needsReview: boolean;
}

export type DutchieRecordWithMeta = {
  [K in keyof DutchieReceivingRecord]: {
    value: DutchieReceivingRecord[K];
    meta: DutchieFieldMeta;
  };
};

export const DUTCHIE_FIELD_ORDER: Array<keyof DutchieReceivingRecord> = [
  "productName",
  "brand",
  "category",
  "subcategory",
  "thc",
  "cbd",
  "netWeightOrUnitCount",
  "batchLotNumber",
  "expirationDate",
  "packageIdMetrcTag",
  "wholesaleCostPerUnit",
  "retailPrice",
  "ingredients",
  "allergens",
  "vendorName",
  "quantityReceived",
];

export const DUTCHIE_FIELD_LABELS: Record<keyof DutchieReceivingRecord, string> = {
  productName: "Product Name",
  brand: "Brand",
  category: "Category",
  subcategory: "Subcategory",
  thc: "THC",
  cbd: "CBD",
  netWeightOrUnitCount: "Net Weight / Unit Count",
  batchLotNumber: "Batch / Lot #",
  expirationDate: "Expiration Date",
  packageIdMetrcTag: "Package ID / METRC Tag",
  wholesaleCostPerUnit: "Wholesale Cost / Unit",
  retailPrice: "Retail Price",
  ingredients: "Ingredients",
  allergens: "Allergens",
  vendorName: "Vendor",
  quantityReceived: "Quantity Received",
};

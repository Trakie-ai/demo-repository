import type { DutchieReceivingRecord } from "./types.js";

export interface DutchieCategory {
  id: string;
  label: string;
  fields: ReadonlyArray<keyof DutchieReceivingRecord>;
}

export const DUTCHIE_CATEGORIES: ReadonlyArray<DutchieCategory> = [
  {
    id: "identity",
    label: "Product Identity",
    fields: ["productName", "brand", "category", "subcategory"],
  },
  {
    id: "compliance",
    label: "Compliance & Tracking",
    fields: [
      "thc",
      "cbd",
      "netWeightOrUnitCount",
      "batchLotNumber",
      "expirationDate",
      "packageIdMetrcTag",
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    fields: ["wholesaleCostPerUnit", "retailPrice"],
  },
  {
    id: "receiving",
    label: "Receiving",
    fields: ["vendorName", "quantityReceived"],
  },
];

export const CATEGORY_BY_FIELD: ReadonlyMap<
  keyof DutchieReceivingRecord,
  DutchieCategory
> = new Map(
  DUTCHIE_CATEGORIES.flatMap((cat) =>
    cat.fields.map((f) => [f, cat] as const)
  )
);

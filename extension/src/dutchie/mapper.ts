import type { Confidence } from "../extraction-types.js";
import type {
  DutchieReceivingRecord,
  DutchieRecordWithMeta,
} from "./types.js";
import { DUTCHIE_FIELD_ORDER } from "./types.js";

export function needsReview(confidence: Confidence): boolean {
  return confidence === "red";
}

export function emptyDutchieRecord(): DutchieRecordWithMeta {
  const record = {} as DutchieRecordWithMeta;
  for (const key of DUTCHIE_FIELD_ORDER) {
    (record as Record<string, { value: null; meta: { confidence: Confidence; needsReview: boolean } }>)[key] = {
      value: null,
      meta: { confidence: "red", needsReview: true },
    };
  }
  return record;
}

export function applyFieldToRecord(
  record: DutchieRecordWithMeta,
  fieldName: string,
  value: string | number | null,
  confidence: Confidence
): void {
  if (!(fieldName in record)) return;
  const key = fieldName as keyof DutchieReceivingRecord;
  // Cast to bypass the discriminated union — applyFieldToRecord trusts the
  // relay to only send values that match each field's declared type.
  (record[key] as { value: string | number | null; meta: { confidence: Confidence; needsReview: boolean } }) = {
    value,
    meta: { confidence, needsReview: needsReview(confidence) },
  };
}

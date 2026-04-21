export type Confidence = "green" | "red";

export interface ExtractionFieldEvent {
  sessionId: string;
  lineItemIndex: number;
  fieldName: string;
  value: string | number | null;
  confidence: Confidence;
}

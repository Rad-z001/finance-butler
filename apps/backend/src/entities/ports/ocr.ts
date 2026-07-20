import type { ReceiptData, SlipData } from "@finance-butler/shared";

/** Implemented by TASK-03 (apps/backend/src/ocr/). Core wires these in container.ts. */

export interface IOcrProvider {
  extractText(image: Buffer): Promise<{ text: string; confidence: number }>;
}

export interface IImageClassifier {
  classify(image: Buffer): Promise<"slip" | "receipt" | "other">;
}

export interface ISlipExtractor {
  extract(image: Buffer): Promise<SlipData>;
}

export interface IReceiptExtractor {
  extract(image: Buffer): Promise<ReceiptData>;
}

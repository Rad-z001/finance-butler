/** OCR result contracts — implemented by TASK-03, consumed by core. */

export interface FieldValue<T> {
  value: T;
  /** 0..1; QR-decoded fields are 1.0 */
  confidence: number;
}

export interface SlipData {
  bank?: FieldValue<string>;
  amount: FieldValue<string>;
  transRef?: FieldValue<string>;
  senderName?: FieldValue<string>;
  senderAccount?: FieldValue<string>;
  receiverName?: FieldValue<string>;
  receiverAccount?: FieldValue<string>;
  transDate?: FieldValue<string>;
  rawText: string;
  qrPayload?: string;
  needsReview: boolean;
}

export interface ReceiptItemData {
  name: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface ReceiptData {
  storeName?: FieldValue<string>;
  taxId?: FieldValue<string>;
  items: ReceiptItemData[];
  subtotal?: FieldValue<string>;
  vat?: FieldValue<string>;
  total: FieldValue<string>;
  purchasedAt?: FieldValue<string>;
  suggestedCategoryKey?: string;
  rawText: string;
  needsReview: boolean;
}

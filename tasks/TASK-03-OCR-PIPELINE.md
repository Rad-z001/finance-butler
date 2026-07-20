# TASK-03 — OCR Pipeline (Owner: OCR AI) — branch `feat/ocr`

Slip and receipt understanding, in `apps/backend/src/ocr/`. Consumed by core via ports — you implement interfaces, core wires them.

## Read first
`docs/03-WORKFLOWS.md` §2 · `apps/backend/prisma/schema.prisma` (Slip, Receipt, ReceiptItem, Attachment) · `tasks/TASK-00-COORDINATION.md`

## Interfaces to implement (`src/entities/ports/ocr.ts`, published by core)
```ts
interface IOcrProvider {           // raw text extraction
  extractText(image: Buffer): Promise<{ text: string; confidence: number }>;
}
interface IImageClassifier {       // slip | receipt | other
  classify(image: Buffer): Promise<"slip" | "receipt" | "other">;
}
interface ISlipExtractor {
  extract(image: Buffer): Promise<SlipData>;   // types in packages/shared
}
interface IReceiptExtractor {
  extract(image: Buffer): Promise<ReceiptData>;
}
```

## Deliverables
1. **`GoogleVisionOcrProvider`** (primary) + **`TesseractOcrProvider`** (fallback/dev, `tha+eng` traineddata) — selected by env `OCR_PROVIDER`
2. **QR decoder first**: Thai bank slips embed an EMVCo-style QR/barcode — decode it (`jsQR`/`zxing`) before OCR; QR amount/ref/date are authoritative, OCR fills names
3. **Slip extractors per bank template**: SCB, KBank, Krungthai, Bangkok Bank, TrueMoney, PromptPay generic — regex/anchor-based field extraction (bank, amount, ref, sender, receiver, date, time). Detect bank by logo keywords/colors in OCR text
4. **Receipt extractor**: store name, tax ID, line items (name/qty/price), VAT, total, date; use Claude (Haiku, tool-use) to structure noisy OCR text — the LLM call goes through core's `IAiClient` port
5. **Confidence policy**: every field carries confidence; if amount confidence < 0.9 or QR missing, output flags `needsReview: true` (core will ask the user to confirm the amount)
6. Persist raw OCR text + confidence to `Slip.rawOcrText` / `Receipt.rawOcrText` via the repositories core provides — never touch Prisma directly

## Test corpus
Create `src/tests/fixtures/slips/` with synthetic slip images (generate with canvas — do NOT commit real user slips) covering each bank template + a rotated/blurry case. Unit tests per extractor; ≥95% field accuracy on amount/ref across the corpus.

## Acceptance criteria
- Slip with QR → amount/ref extracted with confidence 1.0, no LLM call
- Slip without QR → template extraction; ambiguous fields structured by Haiku
- Receipt → items sum + VAT reconciles with total (±0.01) or `needsReview`
- Any garbage image → `"other"` classification, graceful "อ่านรูปไม่ออก 🙏" path (core handles copy)

## Schema/contract change requests
_(append here)_

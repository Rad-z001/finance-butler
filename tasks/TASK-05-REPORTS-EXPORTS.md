# TASK-05 — Reports & Exports (Owner: Reports AI) — branch `feat/reports`

Excel / CSV / PDF generation in `apps/backend/src/reports/`, delivered as BullMQ jobs + S3 presigned URLs.

## Read first
`docs/04-API-CONTRACTS.md` §Reports · `docs/03-WORKFLOWS.md` §8 · `tasks/TASK-00-COORDINATION.md`

## Interface to implement (`src/entities/ports/report-generator.ts`)
```ts
interface IReportGenerator {
  generate(req: ReportRequest): Promise<{ buffer: Buffer; filename: string; mime: string }>;
}
// ReportRequest = { userId, type: "monthly"|"yearly"|"category", format: "xlsx"|"csv"|"pdf", params }
```
Data comes from core repositories/StatsService passed into your constructor — no direct Prisma.

## Deliverables
1. **XLSX** (exceljs): summary sheet (income/expense/balance, category ranking with bars via conditional formatting) + transactions sheet (typed columns, ฿ number format, frozen header, autofilter)
2. **CSV**: UTF-8 **with BOM** (Excel-Thai compatibility), RFC 4180
3. **PDF** (pdfkit or puppeteer-html — pick one, justify in PR): monthly/yearly report with charts (render ECharts to PNG server-side or draw simple bars), **embed a Thai font (Sarabun)** — default PDF fonts cannot render Thai
4. Report job processor: `reports` queue → generate → upload S3 → mark job done with presigned URL (TTL 24 h) → optional LINE push with link
5. Filename convention: `finance-butler_{type}_{YYYY-MM}_{userId8}.{ext}`

## Acceptance criteria
- Thai text renders correctly in all three formats (open-and-eyeball + automated glyph check for PDF)
- 10,000-transaction export completes < 30 s, streams (no full-buffer OOM for CSV/XLSX)
- Numbers in XLSX are numbers (not strings); totals row uses formulas
- Job failure → retried 3×, then user notified politely

## Schema/contract change requests
_(append here)_

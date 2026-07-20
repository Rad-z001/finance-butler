/** Implemented by TASK-05 (apps/backend/src/reports/). */

export interface ReportRequest {
  userId: string;
  type: "monthly" | "yearly" | "category";
  format: "xlsx" | "csv" | "pdf";
  params: { year: number; month?: number; categoryId?: string };
}

export interface IReportGenerator {
  generate(req: ReportRequest): Promise<{ buffer: Buffer; filename: string; mime: string }>;
}

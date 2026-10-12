/** Reporte de conciliación (audit-service, US47 y US48). */

export type ToleranceStatus = 'WITHIN' | 'EXCEEDED' | 'NOT_RECEIVED';

export const TOLERANCE_STATUS_LABELS: Readonly<Record<ToleranceStatus, string>> = {
  WITHIN: 'Dentro de la tolerancia',
  EXCEEDED: 'Supera la tolerancia',
  NOT_RECEIVED: 'Sin conformidad',
};

export type PendingCaseType = 'RECEPTION_PENDING' | 'OPEN_DISCREPANCY';

export const PENDING_CASE_LABELS: Readonly<Record<PendingCaseType, string>> = {
  RECEPTION_PENDING: 'Recepción pendiente',
  OPEN_DISCREPANCY: 'Discrepancia abierta',
};

export interface ReportFilters {
  worksiteId: string | null;
  worksiteName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  from: string | null;
  to: string | null;
}

export interface ReconciliationRow {
  worksiteId: string;
  worksiteName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  materialId: string;
  sku: string | null;
  materialName: string | null;
  unit: string | null;
  dispatchCount: number;
  dispatched: number;
  received: number;
  pendingReception: number;
  confirmedDispatched: number;
  shrinkage: number | null;
  shrinkagePercent: number | null;
  tolerancePercent: number | null;
  toleranceStatus: ToleranceStatus;
  linesOutOfTolerance: number;
  openDiscrepancies: number;
}

export interface UnitTotal {
  unit: string;
  dispatched: number;
  received: number;
  pendingReception: number;
  shrinkage: number | null;
  shrinkagePercent: number | null;
}

export interface ReportSummary {
  dispatchCount: number;
  pendingReceptions: number;
  materialRows: number;
  rowsExceedingTolerance: number;
  linesOutOfTolerance: number;
  openDiscrepancies: number;
}

export interface PendingCase {
  type: PendingCaseType;
  dispatchId: string | null;
  manifestCode: string | null;
  discrepancyId: string | null;
  worksiteName: string | null;
  warehouseName: string | null;
  material: string | null;
  status: string | null;
  since: string | null;
  detail: string | null;
}

export interface ReconciliationReport {
  filters: ReportFilters;
  generatedAt: string;
  generatedBy: string | null;
  rows: ReconciliationRow[];
  totalsByUnit: UnitTotal[];
  summary: ReportSummary;
  pendingCases: PendingCase[];
}

export interface ReportQuery {
  worksiteId?: string;
  warehouseId?: string;
  /** AAAA-MM-DD, incluido. */
  from?: string;
  /** AAAA-MM-DD, incluido. */
  to?: string;
}

export type ExportFormat = 'csv' | 'pdf';

/** Archivo descargado con el nombre que propone el servidor. */
export interface DownloadedFile {
  fileName: string;
  blob: Blob;
}

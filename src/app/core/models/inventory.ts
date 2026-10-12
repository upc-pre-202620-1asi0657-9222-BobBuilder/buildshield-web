/** Inventario del Sprint 4 (inventory-service): historial, conteos y devoluciones. */

export type EntryType = 'INITIAL' | 'REPLENISHMENT';

export const ENTRY_TYPE_LABELS: Readonly<Record<EntryType, string>> = {
  INITIAL: 'Inventario inicial',
  REPLENISHMENT: 'Reposición',
};

export const MOVEMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  INITIAL: 'Inventario inicial',
  REPLENISHMENT: 'Reposición',
  ENTRY: 'Entrada',
  RESERVE: 'Reserva',
  RELEASE: 'Liberación de reserva',
  DISPATCH: 'Despacho',
  DEDUCTION: 'Salida',
  ADJUSTMENT_IN: 'Ajuste a favor',
  ADJUSTMENT_OUT: 'Ajuste en contra',
  RETURN_OUT: 'Devolución enviada',
  RETURN_IN: 'Devolución recibida',
};

/** Tipos que se ofrecen como filtro del historial (US40). */
export const MOVEMENT_FILTER_TYPES: readonly string[] = [
  'INITIAL',
  'REPLENISHMENT',
  'DISPATCH',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
  'ENTRY',
];

export interface StockMovement {
  id: string;
  locationId: string;
  locationType: 'WAREHOUSE' | 'WORKSITE' | string;
  locationName: string | null;
  materialId: string;
  sku: string | null;
  type: string;
  quantity: number;
  balanceAfter: number;
  reference: string | null;
  occurredAt: string;
  recordedBy: string | null;
}

export interface MovementPage {
  items: StockMovement[];
  page: number;
  size: number;
  total: number;
}

export interface MovementQuery {
  locationId?: string;
  materialId?: string;
  type?: string;
  /** ISO-8601 incluido. */
  from?: string;
  /** ISO-8601 excluido. */
  to?: string;
  page?: number;
  size?: number;
}

// Conteo de validación (US41) ----------------------------------------------

export type CountStatus =
  | 'IN_PROGRESS'
  | 'MATCHED'
  | 'DIFFERENCES_FOUND'
  | 'REVIEWED'
  | 'ADJUSTED'
  | 'CANCELLED';

export const COUNT_STATUS_LABELS: Readonly<Record<CountStatus, string>> = {
  IN_PROGRESS: 'En curso',
  MATCHED: 'Sin diferencias',
  DIFFERENCES_FOUND: 'Con diferencias',
  REVIEWED: 'Revisado',
  ADJUSTED: 'Ajustado',
  CANCELLED: 'Anulado',
};

export interface StockCountLine {
  materialId: string;
  sku: string | null;
  materialName: string | null;
  unit: string | null;
  countedQty: number | null;
  systemQty: number | null;
  /** Contado menos sistema; nulo antes de finalizar. */
  difference: number | null;
}

export interface StockCount {
  id: string;
  warehouseId: string;
  warehouseName: string;
  status: CountStatus;
  note: string | null;
  startedBy: string;
  startedAt: string;
  finishedAt: string | null;
  differenceCount: number;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adjustmentReason: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
  cancelledAt: string | null;
  lines: StockCountLine[];
}

// Devolución de saldos (US43) ----------------------------------------------

export type ReturnStatus =
  | 'REGISTERED'
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CANCELLED';

export const RETURN_STATUS_LABELS: Readonly<Record<ReturnStatus, string>> = {
  REGISTERED: 'Registrada',
  REQUESTED: 'Solicitada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  IN_TRANSIT: 'En retorno',
  RECEIVED: 'Recibida',
  CANCELLED: 'Anulada',
};

export interface MaterialReturnLine {
  id: string;
  materialId: string;
  sku: string | null;
  materialName: string | null;
  unit: string | null;
  quantity: number;
  detail: string | null;
  acceptedQty: number | null;
  rejectedQty: number | null;
  rejectionReason: string | null;
}

export interface MaterialReturn {
  id: string;
  worksiteId: string;
  worksiteName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  status: ReturnStatus;
  note: string | null;
  hasRejections: boolean;
  registeredBy: string;
  registeredAt: string;
  requestedBy: string | null;
  requestedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  lines: MaterialReturnLine[];
}

export interface OriginWarehouse {
  warehouseId: string;
  warehouseName: string | null;
}

export interface WorksiteBalanceLine {
  materialId: string;
  sku: string | null;
  materialName: string | null;
  unit: string | null;
  availableQty: number;
  pendingReturnQty: number;
  returnableQty: number;
  originWarehouses: OriginWarehouse[];
}

export interface WorksiteBalance {
  worksiteId: string;
  worksiteName: string | null;
  lines: WorksiteBalanceLine[];
}

export interface RegisterReturnRequest {
  worksiteId: string;
  warehouseId?: string | null;
  note?: string | null;
  lines: {materialId: string; quantity: number; detail?: string | null}[];
}

export interface VerifiedReturnLine {
  materialId: string;
  acceptedQty: number;
  rejectionReason?: string | null;
}

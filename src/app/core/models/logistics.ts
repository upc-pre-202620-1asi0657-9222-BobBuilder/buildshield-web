/** Contrato del Sprint 2: despachos, manifiesto y recepciones. */

export type DispatchStatus = 'PREPARING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export const DISPATCH_STATUS_LABELS: Readonly<Record<string, string>> = {
  PREPARING: 'En preparación',
  IN_TRANSIT: 'En tránsito',
  RECEIVED: 'Recibido',
  CANCELLED: 'Anulado',
};

export interface DispatchLine {
  id: string;
  orderLineId: string;
  materialId: string;
  sku: string;
  materialName?: string;
  unit: string;
  quantity: number;
}

export interface Carrier {
  carrierName: string;
  carrierDocument: string;
  plate: string;
}

export interface DepartureWeighing {
  grossKg: number;
  tareKg: number;
  netKg?: number;
  ticketPhotoUrl?: string | null;
  weighedAt?: string;
}

export interface Dispatch {
  id: string;
  code?: string;
  orderId: string;
  worksiteId?: string;
  warehouseId?: string;
  status: DispatchStatus | string;
  statusLabel?: string;
  carrier?: Carrier | null;
  departureWeighing?: DepartureWeighing | null;
  createdAt?: string;
  departedAt?: string | null;
  lines: DispatchLine[];
}

export interface CreateDispatchRequest {
  orderId: string;
  lines: Array<{orderLineId: string; quantity: number}>;
}

export interface DispatchManifest extends Dispatch {
  warehouseName?: string;
  warehouseAddress?: string;
  worksiteName?: string;
  worksiteAddress?: string;
  qrCodePngBase64: string;
}

export type ReceptionStatus = 'IN_PROGRESS' | 'CONFIRMED';

export interface ReceptionLine {
  id: string;
  dispatchLineId?: string;
  materialId: string;
  sku: string;
  materialName?: string;
  unit: string;
  dispatchedQty: number;
  receivedQty: number | null;
}

export interface Reception {
  id: string;
  dispatchId: string;
  status: ReceptionStatus | string;
  lines: ReceptionLine[];
  confirmedAt?: string | null;
}

/** Fila de GET /receptions/{id}/comparison: una por material. */
export interface ComparisonRow {
  materialId: string;
  sku: string;
  materialName?: string;
  unit?: string;
  requested: number;
  dispatched: number;
  received: number | null;
  difference: number;
  shrinkagePercent: number;
  withinTolerance: boolean;
  tolerancePercent?: number;
}

export function dispatchStatusLabel(dispatch: Pick<Dispatch, 'status' | 'statusLabel'>): string {
  return DISPATCH_STATUS_LABELS[dispatch.status] ?? dispatch.statusLabel ?? dispatch.status;
}

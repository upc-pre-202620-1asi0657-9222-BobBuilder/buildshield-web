/**
 * Contrato de despachos, manifiesto y recepciones: Sprint 2 (buildshield-core
 * 1.1.0) más el Sprint 3 (anulación, incidencias, custodia, recepción parcial y
 * pesaje de llegada).
 */

export type DispatchStatus = 'PREPARED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export type DispatchType = 'COMPLETE' | 'PARTIAL';

export const DISPATCH_STATUS_LABELS: Readonly<Partial<Record<string, string>>> = {
  PREPARED: 'Preparado',
  IN_TRANSIT: 'En tránsito',
  RECEIVED: 'Recibido',
  CANCELLED: 'Anulado',
};

export const DISPATCH_TYPE_LABELS: Readonly<Partial<Record<string, string>>> = {
  COMPLETE: 'Completo',
  PARTIAL: 'Parcial',
};

export interface DispatchLine {
  id: string;
  orderLineId: string;
  materialId: string;
  quantity: number;
}

/** Transportista tal como lo devuelve el backend. */
export interface CarrierView {
  name: string;
  document: string;
  plate: string;
}

/** Cuerpo de PATCH /dispatches/{id}/carrier. */
export interface CarrierRequest {
  carrierName: string;
  carrierDocument: string;
  plate: string;
}

export interface WeighingRequest {
  grossKg: number;
  tareKg: number;
  ticketPhotoUrl?: string | null;
}

export interface WeighingView extends WeighingRequest {
  netKg: number;
  weighedAt?: string;
  weighedBy?: string;
}

export interface Dispatch {
  id: string;
  orderId: string;
  warehouseId: string;
  worksiteId: string;
  type: DispatchType | string;
  typeLabel?: string;
  status: DispatchStatus | string;
  statusLabel?: string;
  manifestCode: string;
  preparedAt: string;
  departedAt: string | null;
  receivedAt: string | null;
  carrier: CarrierView | null;
  departureWeighing: WeighingView | null;
  lines: DispatchLine[];
  /** Sprint 3 (US25): fecha y motivo de la anulación. */
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  /** Sprint 3 (US31): incidencias registradas en ruta. */
  incidentCount?: number;
}

export interface CreateDispatchRequest {
  orderId: string;
  lines: Array<{orderLineId: string; quantity: number}>;
}

export interface ManifestSite {
  id: string;
  name: string;
  address: string;
}

export interface ManifestLine {
  materialId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface DispatchManifest {
  manifestCode: string;
  dispatchId: string;
  status: DispatchStatus | string;
  statusLabel?: string;
  type: DispatchType | string;
  typeLabel?: string;
  preparedAt: string;
  departedAt: string | null;
  order: {id: string; placedAt: string};
  worksite: ManifestSite;
  warehouse: ManifestSite;
  lines: ManifestLine[];
  carrier: CarrierView | null;
  departureWeighing: WeighingView | null;
  qrContent: string;
  qrCodePngBase64: string;
}

export type ReceptionStatus = 'IN_PROGRESS' | 'PARTIALLY_RECEIVED' | 'CONFIRMED';

export interface ReceptionLine {
  id: string;
  dispatchLineId: string;
  orderLineId: string;
  materialId: string;
  dispatchedQty: number;
  receivedQty: number | null;
  shrinkagePercent: number | null;
}

export interface Reception {
  id: string;
  dispatchId: string;
  orderId: string;
  warehouseId: string;
  worksiteId: string;
  status: ReceptionStatus | string;
  statusLabel?: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  lines: ReceptionLine[];
  /** Sprint 3 (US38): recepciones parciales registradas. */
  partialCount?: number;
  lastPartialAt?: string | null;
  /** Sprint 3 (US29): pesaje de llegada, o null si aún no se registra. */
  arrivalWeighing?: ArrivalWeighing | null;
}

/** Línea de GET /receptions/{id}/comparison. */
export interface ComparisonRow {
  lineId: string;
  materialId: string;
  sku: string;
  materialName: string;
  unit: string;
  requested: number;
  dispatched: number;
  received: number | null;
  difference: number | null;
  shrinkagePercent: number | null;
  tolerancePercent: number;
  withinTolerance: boolean | null;
}

export interface Comparison {
  receptionId: string;
  dispatchId: string;
  orderId: string;
  status: ReceptionStatus | string;
  statusLabel?: string;
  complete: boolean;
  withinTolerance: boolean;
  lines: ComparisonRow[];
}

export function dispatchStatusLabel(dispatch: Pick<Dispatch, 'status' | 'statusLabel'>): string {
  return DISPATCH_STATUS_LABELS[dispatch.status] ?? dispatch.statusLabel ?? dispatch.status;
}

// Sprint 3 -----------------------------------------------------------------

/** Cuerpo de POST /dispatches/{id}/cancel (US25). */
export interface CancelDispatchRequest {
  reason: string;
}

export type IncidentType = 'DELAY' | 'VEHICLE_FAILURE' | 'DAMAGE' | 'ACCIDENT' | 'ROUTE_CHANGE' | 'OTHER';

export const INCIDENT_TYPE_LABELS: Readonly<Record<IncidentType, string>> = {
  DELAY: 'Retraso',
  VEHICLE_FAILURE: 'Falla del vehículo',
  DAMAGE: 'Daño de la carga',
  ACCIDENT: 'Accidente',
  ROUTE_CHANGE: 'Cambio de ruta',
  OTHER: 'Otra',
};

export const INCIDENT_TYPES = Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[];

/** Cuerpo de POST /dispatches/{id}/incidents (US32). */
export interface IncidentRequest {
  type: IncidentType;
  observation: string;
}

export interface TransitIncident {
  id: string;
  dispatchId: string;
  type: IncidentType | string;
  typeLabel?: string;
  observation: string;
  reportedBy: string;
  reportedAt: string;
}

export function incidentTypeLabel(incident: Pick<TransitIncident, 'type' | 'typeLabel'>): string {
  return INCIDENT_TYPE_LABELS[incident.type as IncidentType] ?? incident.typeLabel ?? incident.type;
}

/** Evento de GET /dispatches/{id}/custody (US39). */
export interface CustodyEvent {
  at: string;
  type: string;
  label: string;
  actorId: string | null;
  actorName: string | null;
  detail: string | null;
}

export interface Custody {
  dispatchId: string;
  manifestCode: string;
  events: CustodyEvent[];
}

/** Respuesta de POST /receptions/{id}/arrival-weighing (US29). */
export interface ArrivalWeighing {
  grossKg: number;
  tareKg: number;
  netKg: number;
  /** null cuando el despacho no tuvo pesaje de salida. */
  departureNetKg: number | null;
  differenceKg: number | null;
  differencePercent: number | null;
  tolerancePercent: number;
  withinTolerance: boolean | null;
  ticketPhotoUrl?: string | null;
}

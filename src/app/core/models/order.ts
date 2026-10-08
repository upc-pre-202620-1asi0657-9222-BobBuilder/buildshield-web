export type OrderStatus =
  | 'REGISTERED'
  | 'APPROVAL_PENDING'
  | 'IN_REVIEW'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CLOSED'
  | 'CANCELLED';

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  REGISTERED: 'Registrado',
  APPROVAL_PENDING: 'Aprobando',
  IN_REVIEW: 'Aprobado',
  PARTIALLY_FULFILLED: 'Parcialmente atendido',
  FULFILLED: 'Atendido',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
};

/** Estados desde los que el almacén puede despachar (aprobar lleva el pedido a IN_REVIEW). */
export const DISPATCHABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'IN_REVIEW',
  'PARTIALLY_FULFILLED',
];

/**
 * Estado transitorio mientras la saga reserva el stock (microservicios): luego
 * pasa a IN_REVIEW o vuelve a REGISTERED con `rejectionReason`.
 */
export const APPROVAL_PENDING: OrderStatus = 'APPROVAL_PENDING';

export interface OrderLine {
  /** Id de la línea; el contrato del Sprint 2 lo usa para despachar. */
  id?: string;
  materialId: string;
  sku: string;
  unit: string;
  requested: number;
  dispatched: number;
  cancelled: number;
  received: number;
  pending: number;
}

export interface Order {
  id: string;
  worksiteId: string;
  warehouseId: string;
  requestedBy: string;
  status: OrderStatus;
  statusLabel: string;
  notes: string | null;
  rejectionReason: string | null;
  placedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  requiredDate?: string | null;
  lines: OrderLine[];
}

export interface PlaceOrderRequest {
  worksiteId: string;
  warehouseId: string;
  notes?: string;
  /** Fecha requerida en obra (AAAA-MM-DD). */
  requiredDate: string;
  lines: Array<{materialId: string; quantity: number}>;
}

/** Id con el que se referencia una línea de pedido al despachar. */
export function orderLineKey(line: OrderLine): string {
  return line.id ?? line.materialId;
}

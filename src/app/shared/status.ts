import {ORDER_STATUS_LABELS, Order, OrderStatus} from '../core/models/order';

export function orderStatusLabel(order: Pick<Order, 'status' | 'statusLabel'>): string {
  return ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.statusLabel ?? order.status;
}

/** Clase de badge según el estado del pedido o despacho. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'FULFILLED':
    case 'CLOSED':
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'RESOLVED':
      return 'badge-ok';
    case 'CANCELLED':
    case 'ESCALATED':
      return 'badge-bad';
    case 'REGISTERED':
    case 'PREPARED':
    case 'PARTIALLY_FULFILLED':
    case 'PARTIALLY_RECEIVED':
    case 'OPEN':
      return 'badge-warn';
    case 'IN_TRANSIT':
    case 'IN_REVIEW':
    case 'RESPONDED':
      return 'badge-info';
    default:
      return '';
  }
}

/** Mapa id → nombre para mostrar obras, almacenes o materiales. */
export function nameIndex<T extends {id: string; name: string}>(items: readonly T[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

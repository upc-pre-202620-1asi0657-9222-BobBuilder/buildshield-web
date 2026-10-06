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
      return 'badge-ok';
    case 'CANCELLED':
      return 'badge-bad';
    case 'REGISTERED':
    case 'PREPARING':
    case 'IN_TRANSIT':
    case 'PARTIALLY_FULFILLED':
      return 'badge-warn';
    default:
      return '';
  }
}

/** Mapa id → nombre para mostrar obras, almacenes o materiales. */
export function nameIndex<T extends {id: string; name: string}>(items: readonly T[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

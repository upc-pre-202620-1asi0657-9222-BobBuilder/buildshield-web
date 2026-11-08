import {MaterialReturn, RETURN_STATUS_LABELS, ReturnStatus} from '../../core/models/inventory';
import {Role} from '../../core/models/role';

export function returnStatusLabel(status: ReturnStatus): string {
  return RETURN_STATUS_LABELS[status] ?? status;
}

export function returnBadge(status: ReturnStatus): string {
  switch (status) {
    case 'RECEIVED':
      return 'badge-ok';
    case 'REJECTED':
    case 'CANCELLED':
      return 'badge-bad';
    case 'REGISTERED':
    case 'REQUESTED':
      return 'badge-warn';
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 'badge-info';
    default:
      return '';
  }
}

export type ReturnAction = 'request' | 'cancel' | 'approve' | 'reject' | 'dispatch' | 'receive';

/**
 * Acciones de la devolución según estado y rol (US43). La obra registra,
 * solicita, inicia el retorno y anula; el almacén de origen aprueba, rechaza y
 * recibe. El administrador puede hacer ambas partes.
 */
export function returnActions(ret: Pick<MaterialReturn, 'status'>, role: Role | null): readonly ReturnAction[] {
  const site = role === 'SITE_MANAGER' || role === 'ADMINISTRATOR';
  const warehouse = role === 'WAREHOUSE_MANAGER' || role === 'ADMINISTRATOR';
  const actions: ReturnAction[] = [];
  switch (ret.status) {
    case 'REGISTERED':
      if (site) actions.push('request', 'cancel');
      break;
    case 'REQUESTED':
      if (warehouse) actions.push('approve', 'reject');
      if (site) actions.push('cancel');
      break;
    case 'APPROVED':
      if (site) actions.push('dispatch');
      break;
    case 'IN_TRANSIT':
      if (warehouse) actions.push('receive');
      break;
  }
  return actions;
}

import {CLOSED_DISCREPANCY_STATUSES, EVIDENCE_MAX_BYTES, EVIDENCE_MIME_TYPES} from '../../core/models/discrepancy';
import {Role} from '../../core/models/role';

/** Qué puede hacer cada rol con una discrepancia según su estado (US36). */
export interface DiscrepancyActions {
  respond: boolean;
  accept: boolean;
  escalate: boolean;
  resolve: boolean;
  upload: boolean;
}

export function discrepancyActionsFor(role: Role | null, status: string): DiscrepancyActions {
  const warehouse = role === 'ADMINISTRATOR' || role === 'WAREHOUSE_MANAGER';
  const site = role === 'SITE_MANAGER';
  return {
    respond: warehouse && status === 'OPEN',
    accept: site && status === 'RESPONDED',
    escalate: site && status === 'RESPONDED',
    resolve: role === 'ADMINISTRATOR' && status === 'ESCALATED',
    upload: site && !CLOSED_DISCREPANCY_STATUSES.includes(status),
  };
}

/** Quién mueve la discrepancia a continuación, para quien no tiene acciones. */
export function nextStepHint(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Esperando la respuesta del almacén.';
    case 'RESPONDED':
      return 'Esperando que la obra acepte la respuesta o la escale.';
    case 'ESCALATED':
      return 'Esperando la decisión final del administrador.';
    case 'ACCEPTED':
      return 'Cerrada: la obra aceptó la respuesta del almacén.';
    case 'RESOLVED':
      return 'Cerrada con la decisión del administrador.';
    default:
      return '';
  }
}

/** Valida la foto antes de subirla; devuelve el mensaje de error o null. */
export function evidenceProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!EVIDENCE_MIME_TYPES.includes(file.type)) {
    return 'La foto debe ser JPG, PNG o WEBP.';
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return 'La foto pesa más de 5 MB. Toma otra con menor resolución.';
  }
  return null;
}

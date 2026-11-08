/** Contrato del módulo de discrepancias (Sprint 3, US36). */

export type DiscrepancyStatus = 'OPEN' | 'RESPONDED' | 'ESCALATED' | 'ACCEPTED' | 'RESOLVED';
export type DiscrepancyType = 'SHORTAGE' | 'DAMAGE' | 'EXCESS' | 'WRONG_MATERIAL';

export const DISCREPANCY_STATUSES: readonly DiscrepancyStatus[] = [
  'OPEN',
  'RESPONDED',
  'ESCALATED',
  'ACCEPTED',
  'RESOLVED',
];

export const DISCREPANCY_STATUS_LABELS: Readonly<Record<DiscrepancyStatus, string>> = {
  OPEN: 'Abierta',
  RESPONDED: 'Respondida',
  ESCALATED: 'Escalada',
  ACCEPTED: 'Aceptada',
  RESOLVED: 'Resuelta',
};

export const DISCREPANCY_TYPE_LABELS: Readonly<Record<DiscrepancyType, string>> = {
  SHORTAGE: 'Faltante',
  DAMAGE: 'Daño',
  EXCESS: 'Exceso',
  WRONG_MATERIAL: 'Material equivocado',
};

export const DISCREPANCY_TYPES = Object.keys(DISCREPANCY_TYPE_LABELS) as DiscrepancyType[];

/** Estados cerrados: ya no admiten acciones ni evidencias. */
export const CLOSED_DISCREPANCY_STATUSES: readonly string[] = ['ACCEPTED', 'RESOLVED'];

export interface DiscrepancyNote {
  by: string;
  at: string;
}

export interface Evidence {
  id: string;
  url: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Discrepancy {
  id: string;
  organizationId: string;
  receptionId: string;
  dispatchId: string;
  manifestCode: string;
  worksiteId: string;
  warehouseId: string;
  materialId: string;
  sku: string;
  materialName: string;
  type: DiscrepancyType | string;
  typeLabel?: string;
  quantity: number;
  shrinkagePercent: number | null;
  tolerancePercent: number | null;
  observation: string | null;
  status: DiscrepancyStatus | string;
  statusLabel?: string;
  openedBy: string;
  openedAt: string;
  response?: (DiscrepancyNote & {text: string}) | null;
  escalation?: (DiscrepancyNote & {reason: string}) | null;
  resolution?: (DiscrepancyNote & {decision: string}) | null;
  evidences: Evidence[];
}

export interface DiscrepancyFilter {
  status?: string;
  worksiteId?: string;
  dispatchId?: string;
}

/** Cuerpo de POST /discrepancies. */
export interface CreateDiscrepancyRequest {
  receptionId: string;
  materialId: string;
  type: DiscrepancyType;
  quantity: number;
  observation: string;
}

/** Tipos de evidencia que acepta el backend (hasta 5 MB). */
export const EVIDENCE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

export function discrepancyStatusLabel(d: Pick<Discrepancy, 'status' | 'statusLabel'>): string {
  return DISCREPANCY_STATUS_LABELS[d.status as DiscrepancyStatus] ?? d.statusLabel ?? d.status;
}

export function discrepancyTypeLabel(d: Pick<Discrepancy, 'type' | 'typeLabel'>): string {
  return DISCREPANCY_TYPE_LABELS[d.type as DiscrepancyType] ?? d.typeLabel ?? d.type;
}

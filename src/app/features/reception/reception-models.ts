/** Estado del guardado progresivo de una línea de recepción. */
export type LineSaveState = 'pending' | 'saving' | 'saved' | 'retrying' | 'error';

export const SAVE_STATE_LABELS: Readonly<Record<LineSaveState, string>> = {
  pending: 'Pendiente',
  saving: 'Guardando…',
  saved: 'Guardado',
  retrying: 'Reintentando…',
  error: 'No se guardó',
};

/** Fila que muestra la tabla de comparación: una por material. */
export interface ReceptionLineView {
  lineId: string;
  materialId: string;
  sku: string;
  materialName?: string;
  unit?: string;
  requested: number;
  dispatched: number;
  received: number | null;
  difference: number;
  shrinkagePercent: number;
  /** null mientras el backend no haya evaluado la tolerancia. */
  withinTolerance: boolean | null;
  tolerancePercent?: number;
  saveState: LineSaveState;
}

export interface ReceivedChange {
  lineId: string;
  receivedQty: number;
}

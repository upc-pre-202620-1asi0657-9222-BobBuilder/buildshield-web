import {Observable} from 'rxjs';

import {RetryObserver} from '../http/http-context';
import {
  Carrier,
  ComparisonRow,
  CreateDispatchRequest,
  DepartureWeighing,
  Dispatch,
  DispatchManifest,
  Reception,
} from '../models/logistics';

export interface DispatchFilter {
  orderId?: string;
  status?: string;
}

/**
 * Puerto de despachos y recepciones (Sprint 2). La implementación HTTP habla
 * con buildshield-core; la simulada se usa cuando environment.mockSprint2 es true.
 */
export abstract class LogisticsApi {
  /** true cuando las respuestas son simuladas en el navegador. */
  abstract readonly simulated: boolean;

  abstract listDispatches(filter?: DispatchFilter): Observable<Dispatch[]>;
  abstract getDispatch(id: string): Observable<Dispatch>;
  abstract createDispatch(request: CreateDispatchRequest): Observable<Dispatch>;
  abstract setCarrier(id: string, carrier: Carrier): Observable<Dispatch>;
  abstract registerDepartureWeighing(id: string, weighing: DepartureWeighing): Observable<Dispatch>;
  abstract depart(id: string, idempotencyKey?: string): Observable<Dispatch>;
  abstract getManifest(id: string): Observable<DispatchManifest>;

  abstract openReception(dispatchId: string): Observable<Reception>;
  abstract saveReceptionLine(
    receptionId: string,
    lineId: string,
    receivedQty: number,
    onRetry?: RetryObserver,
  ): Observable<unknown>;
  abstract getComparison(receptionId: string): Observable<ComparisonRow[]>;
  abstract confirmReception(receptionId: string, idempotencyKey?: string): Observable<Reception>;
}

/** Acepta la comparación como arreglo o envuelta en {lines|items|materials}. */
export function normalizeComparison(body: unknown): ComparisonRow[] {
  if (Array.isArray(body)) {
    return body as ComparisonRow[];
  }
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ['lines', 'items', 'materials', 'rows']) {
      if (Array.isArray(record[key])) {
        return record[key] as ComparisonRow[];
      }
    }
  }
  return [];
}

/** Merma = (despachado - recibido) / despachado. */
export function computeShrinkage(dispatched: number, received: number | null): {
  difference: number;
  shrinkagePercent: number;
} {
  const got = received ?? 0;
  const difference = round3(dispatched - got);
  const shrinkagePercent = dispatched > 0 ? round2((difference / dispatched) * 100) : 0;
  return {difference, shrinkagePercent};
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

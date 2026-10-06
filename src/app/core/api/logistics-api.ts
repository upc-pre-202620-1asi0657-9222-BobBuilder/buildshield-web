import {Observable} from 'rxjs';

import {RetryObserver} from '../http/http-context';
import {
  CarrierRequest,
  Comparison,
  CreateDispatchRequest,
  Dispatch,
  DispatchManifest,
  Reception,
  WeighingRequest,
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
  abstract createDispatch(request: CreateDispatchRequest, idempotencyKey?: string): Observable<Dispatch>;
  abstract setCarrier(id: string, carrier: CarrierRequest): Observable<Dispatch>;
  abstract registerDepartureWeighing(id: string, weighing: WeighingRequest): Observable<Dispatch>;
  abstract depart(id: string, idempotencyKey?: string): Observable<Dispatch>;
  abstract getManifest(id: string): Observable<DispatchManifest>;

  /** Abre la recepción del despacho; si ya existe, devuelve la existente. */
  abstract openReception(dispatchId: string): Observable<Reception>;
  abstract getReception(id: string): Observable<Reception>;
  abstract saveReceptionLine(
    receptionId: string,
    lineId: string,
    receivedQty: number,
    onRetry?: RetryObserver,
  ): Observable<unknown>;
  abstract getComparison(receptionId: string): Observable<Comparison>;
  abstract confirmReception(receptionId: string, idempotencyKey?: string): Observable<Reception>;
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

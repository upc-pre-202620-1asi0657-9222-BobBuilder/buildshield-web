import {Observable} from 'rxjs';

import {RetryObserver} from '../http/http-context';
import {
  CreateDiscrepancyRequest,
  Discrepancy,
  DiscrepancyFilter,
  Evidence,
} from '../models/discrepancy';
import {
  ArrivalWeighing,
  CarrierRequest,
  Comparison,
  CreateDispatchRequest,
  Custody,
  Dispatch,
  DispatchManifest,
  IncidentRequest,
  Reception,
  TransitIncident,
  WeighingRequest,
} from '../models/logistics';

export interface DispatchFilter {
  orderId?: string;
  status?: string;
}

/**
 * Puerto de despachos, recepciones y discrepancias (Sprints 2 y 3). La
 * implementación HTTP habla con buildshield-core; la simulada se usa cuando
 * environment.mockSprint2 es true.
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

  // Sprint 3: despacho -------------------------------------------------------

  /** US25: anula un despacho Preparado. */
  abstract cancelDispatch(id: string, reason: string, idempotencyKey?: string): Observable<Dispatch>;
  /** US32: registra una incidencia de un despacho En tránsito. */
  abstract registerIncident(
    dispatchId: string,
    incident: IncidentRequest,
    idempotencyKey?: string,
  ): Observable<TransitIncident>;
  abstract listIncidents(dispatchId: string): Observable<TransitIncident[]>;
  /** US26: busca el despacho por el código de su manifiesto (404 si no corresponde). */
  abstract getDispatchByManifest(code: string): Observable<Dispatch>;
  /** US39: línea de tiempo de custodia. */
  abstract getCustody(dispatchId: string): Observable<Custody>;

  // Sprint 3: recepción ------------------------------------------------------

  /** US34: abre (o devuelve) la recepción a partir del código del manifiesto. */
  abstract openReceptionByManifest(manifestCode: string): Observable<Reception>;
  /** US38: registra lo recibido hasta ahora sin cerrar la recepción. */
  abstract savePartialReception(receptionId: string, idempotencyKey?: string): Observable<Reception>;
  /** US29: pesaje de llegada y comparación con el de salida. */
  abstract registerArrivalWeighing(
    receptionId: string,
    weighing: WeighingRequest,
    idempotencyKey?: string,
  ): Observable<ArrivalWeighing>;

  // Sprint 3: discrepancias (US36) -------------------------------------------

  abstract listDiscrepancies(filter?: DiscrepancyFilter): Observable<Discrepancy[]>;
  abstract getDiscrepancy(id: string): Observable<Discrepancy>;
  abstract createDiscrepancy(request: CreateDiscrepancyRequest, idempotencyKey?: string): Observable<Discrepancy>;
  abstract uploadEvidence(discrepancyId: string, file: File): Observable<Evidence>;
  abstract respondDiscrepancy(id: string, text: string, idempotencyKey?: string): Observable<Discrepancy>;
  abstract acceptDiscrepancy(id: string, idempotencyKey?: string): Observable<Discrepancy>;
  abstract escalateDiscrepancy(id: string, reason: string, idempotencyKey?: string): Observable<Discrepancy>;
  abstract resolveDiscrepancy(id: string, decision: string, idempotencyKey?: string): Observable<Discrepancy>;
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

import {HttpClient, HttpContext, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, catchError, throwError} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {ApiError} from '../http/api-error';
import {RETRY_OBSERVER, RetryObserver} from '../http/http-context';
import {IDEMPOTENCY_HEADER} from '../http/idempotency.interceptor';
import {
  CarrierRequest,
  Comparison,
  CreateDispatchRequest,
  Dispatch,
  DispatchManifest,
  Reception,
  WeighingRequest,
} from '../models/logistics';
import {DispatchFilter, LogisticsApi} from './logistics-api';

export const RECEPTION_ALREADY_EXISTS = 'RECEPTION_ALREADY_EXISTS';

function keyHeaders(idempotencyKey?: string): HttpHeaders | undefined {
  return idempotencyKey ? new HttpHeaders({[IDEMPOTENCY_HEADER]: idempotencyKey}) : undefined;
}

/** Id de la recepción existente que el backend envía en el 409 RECEPTION_ALREADY_EXISTS. */
export function existingReceptionId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== RECEPTION_ALREADY_EXISTS) {
    return null;
  }
  const detail = error.details.find((d) => d.field === 'receptionId') ?? error.details[0];
  return detail?.message?.trim() || null;
}

/** Despachos y recepciones contra buildshield-core. */
@Injectable()
export class HttpLogisticsApi extends LogisticsApi {
  override readonly simulated = false;

  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_ENV).apiBaseUrl;

  override listDispatches(filter: DispatchFilter = {}): Observable<Dispatch[]> {
    let params = new HttpParams();
    if (filter.orderId) {
      params = params.set('orderId', filter.orderId);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    return this.http.get<Dispatch[]>(`${this.base}/dispatches`, {params});
  }

  override getDispatch(id: string): Observable<Dispatch> {
    return this.http.get<Dispatch>(`${this.base}/dispatches/${id}`);
  }

  /** Requiere Idempotency-Key: la pantalla pasa la suya o la genera el interceptor. */
  override createDispatch(request: CreateDispatchRequest, idempotencyKey?: string): Observable<Dispatch> {
    return this.http.post<Dispatch>(`${this.base}/dispatches`, request, {
      headers: keyHeaders(idempotencyKey),
    });
  }

  override setCarrier(id: string, carrier: CarrierRequest): Observable<Dispatch> {
    return this.http.patch<Dispatch>(`${this.base}/dispatches/${id}/carrier`, carrier);
  }

  override registerDepartureWeighing(id: string, weighing: WeighingRequest): Observable<Dispatch> {
    return this.http.post<Dispatch>(`${this.base}/dispatches/${id}/departure-weighing`, weighing);
  }

  override depart(id: string, idempotencyKey?: string): Observable<Dispatch> {
    return this.http.post<Dispatch>(`${this.base}/dispatches/${id}/depart`, null, {
      headers: keyHeaders(idempotencyKey),
    });
  }

  override getManifest(id: string): Observable<DispatchManifest> {
    return this.http.get<DispatchManifest>(`${this.base}/dispatches/${id}/manifest`);
  }

  override openReception(dispatchId: string): Observable<Reception> {
    return this.http.post<Reception>(`${this.base}/receptions`, {dispatchId}).pipe(
      catchError((error: unknown) => {
        const existing = existingReceptionId(error);
        return existing ? this.getReception(existing) : throwError(() => error);
      }),
    );
  }

  override getReception(id: string): Observable<Reception> {
    return this.http.get<Reception>(`${this.base}/receptions/${id}`);
  }

  override saveReceptionLine(
    receptionId: string,
    lineId: string,
    receivedQty: number,
    onRetry?: RetryObserver,
  ): Observable<unknown> {
    return this.http.put(
      `${this.base}/receptions/${receptionId}/lines/${lineId}`,
      {receivedQty},
      {context: new HttpContext().set(RETRY_OBSERVER, onRetry ?? null)},
    );
  }

  override getComparison(receptionId: string): Observable<Comparison> {
    return this.http.get<Comparison>(`${this.base}/receptions/${receptionId}/comparison`);
  }

  override confirmReception(receptionId: string, idempotencyKey?: string): Observable<Reception> {
    return this.http.post<Reception>(`${this.base}/receptions/${receptionId}/confirm`, null, {
      headers: keyHeaders(idempotencyKey),
    });
  }
}

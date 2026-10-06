import {HttpClient, HttpContext, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {RETRY_OBSERVER, RetryObserver} from '../http/http-context';
import {IDEMPOTENCY_HEADER} from '../http/idempotency.interceptor';
import {
  Carrier,
  ComparisonRow,
  CreateDispatchRequest,
  DepartureWeighing,
  Dispatch,
  DispatchManifest,
  Reception,
} from '../models/logistics';
import {DispatchFilter, LogisticsApi, normalizeComparison} from './logistics-api';

function keyHeaders(idempotencyKey?: string): HttpHeaders | undefined {
  return idempotencyKey ? new HttpHeaders({[IDEMPOTENCY_HEADER]: idempotencyKey}) : undefined;
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

  override createDispatch(request: CreateDispatchRequest): Observable<Dispatch> {
    return this.http.post<Dispatch>(`${this.base}/dispatches`, request);
  }

  override setCarrier(id: string, carrier: Carrier): Observable<Dispatch> {
    return this.http.patch<Dispatch>(`${this.base}/dispatches/${id}/carrier`, carrier);
  }

  override registerDepartureWeighing(id: string, weighing: DepartureWeighing): Observable<Dispatch> {
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
    return this.http.post<Reception>(`${this.base}/receptions`, {dispatchId});
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

  override getComparison(receptionId: string): Observable<ComparisonRow[]> {
    return this.http
      .get<unknown>(`${this.base}/receptions/${receptionId}/comparison`)
      .pipe(map(normalizeComparison));
  }

  override confirmReception(receptionId: string, idempotencyKey?: string): Observable<Reception> {
    return this.http.post<Reception>(`${this.base}/receptions/${receptionId}/confirm`, null, {
      headers: keyHeaders(idempotencyKey),
    });
  }
}

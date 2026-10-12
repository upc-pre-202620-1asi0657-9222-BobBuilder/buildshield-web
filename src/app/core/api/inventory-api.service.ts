import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {
  CountStatus,
  MaterialReturn,
  MovementPage,
  MovementQuery,
  RegisterReturnRequest,
  ReturnStatus,
  StockCount,
  VerifiedReturnLine,
  WorksiteBalance,
} from '../models/inventory';

function params(values: Record<string, string | number | null | undefined>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      result = result.set(key, String(value));
    }
  }
  return result;
}

/** US40, US41 y US43: historial de movimientos, conteos de validación y devolución de saldos. */
@Injectable({providedIn: 'root'})
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/stock`;

  movementHistory(query: MovementQuery = {}): Observable<MovementPage> {
    return this.http.get<MovementPage>(`${this.base}/movements/history`, {
      params: params({...query, page: query.page ?? 0, size: query.size ?? 20}),
    });
  }

  // Conteos -----------------------------------------------------------------

  listCounts(warehouseId?: string, status?: CountStatus): Observable<StockCount[]> {
    return this.http.get<StockCount[]>(`${this.base}/counts`, {params: params({warehouseId, status})});
  }

  getCount(id: string): Observable<StockCount> {
    return this.http.get<StockCount>(`${this.base}/counts/${id}`);
  }

  startCount(warehouseId: string, note?: string | null, materialIds?: string[]): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/counts`, {
      warehouseId,
      note: note || null,
      materialIds: materialIds?.length ? materialIds : null,
    });
  }

  saveCountLines(id: string, lines: {materialId: string; countedQty: number}[]): Observable<StockCount> {
    return this.http.put<StockCount>(`${this.base}/counts/${id}/lines`, {lines});
  }

  finishCount(id: string): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/counts/${id}/finish`, null);
  }

  reviewCount(id: string, note: string): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/counts/${id}/review`, {note});
  }

  adjustCount(id: string, reason: string): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/counts/${id}/adjustment`, {reason});
  }

  cancelCount(id: string): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/counts/${id}/cancel`, null);
  }

  // Devoluciones --------------------------------------------------------------

  worksiteBalance(worksiteId: string): Observable<WorksiteBalance> {
    return this.http.get<WorksiteBalance>(`${this.base}/worksites/${worksiteId}/balance`);
  }

  listReturns(filter: {status?: ReturnStatus; worksiteId?: string; warehouseId?: string} = {}): Observable<MaterialReturn[]> {
    return this.http.get<MaterialReturn[]>(`${this.base}/returns`, {params: params(filter)});
  }

  getReturn(id: string): Observable<MaterialReturn> {
    return this.http.get<MaterialReturn>(`${this.base}/returns/${id}`);
  }

  registerReturn(request: RegisterReturnRequest): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns`, request);
  }

  requestReturn(id: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/request`, null);
  }

  approveReturn(id: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/approve`, null);
  }

  rejectReturn(id: string, reason: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/reject`, {reason});
  }

  dispatchReturn(id: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/dispatch`, null);
  }

  receiveReturn(id: string, lines: VerifiedReturnLine[]): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/receive`, {lines});
  }

  cancelReturn(id: string): Observable<MaterialReturn> {
    return this.http.post<MaterialReturn>(`${this.base}/returns/${id}/cancel`, null);
  }
}

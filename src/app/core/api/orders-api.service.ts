import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {IDEMPOTENCY_HEADER} from '../http/idempotency.interceptor';
import {Order, PlaceOrderRequest} from '../models/order';

function keyHeaders(idempotencyKey?: string): HttpHeaders | undefined {
  return idempotencyKey ? new HttpHeaders({[IDEMPOTENCY_HEADER]: idempotencyKey}) : undefined;
}

/**
 * Pedidos de materiales. Los POST llevan Idempotency-Key: si el componente
 * pasa una clave (para reusarla cuando el usuario reintenta) se usa esa; si
 * no, la genera idempotencyInterceptor.
 */
@Injectable({providedIn: 'root'})
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/orders`;

  list(): Observable<Order[]> {
    return this.http.get<Order[]>(this.base);
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.base}/${id}`);
  }

  place(request: PlaceOrderRequest, idempotencyKey?: string): Observable<Order> {
    return this.http.post<Order>(this.base, request, {headers: keyHeaders(idempotencyKey)});
  }

  approve(id: string, idempotencyKey?: string): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/approve`, null, {
      headers: keyHeaders(idempotencyKey),
    });
  }

  reject(id: string, reason: string, idempotencyKey?: string): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/reject`, {reason}, {
      headers: keyHeaders(idempotencyKey),
    });
  }
}

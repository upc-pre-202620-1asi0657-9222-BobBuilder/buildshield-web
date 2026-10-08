import {HttpClient, HttpContext, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {SKIP_RETRY} from '../http/http-context';
import {NotificationPage, NotificationQuery} from '../models/notification';

/**
 * Puerto de la bandeja de notificaciones (US43). Solo devuelve las del
 * usuario del token. La implementación simulada se usa con environment.mockSprint2.
 */
export abstract class NotificationsApi {
  abstract list(query?: NotificationQuery): Observable<NotificationPage>;
  abstract unreadCount(): Observable<number>;
  abstract markRead(id: string): Observable<void>;
  abstract markAllRead(): Observable<void>;
}

@Injectable()
export class HttpNotificationsApi extends NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/notifications`;

  override list(query: NotificationQuery = {}): Observable<NotificationPage> {
    const params = new HttpParams()
      .set('unreadOnly', String(query.unreadOnly ?? false))
      .set('page', String(query.page ?? 0))
      .set('size', String(query.size ?? 20));
    return this.http.get<NotificationPage>(this.base, {params});
  }

  /** Consulta de fondo: sin reintentos, la siguiente consulta llega en 60 s. */
  override unreadCount(): Observable<number> {
    return this.http
      .get<{unreadCount: number}>(`${this.base}/unread-count`, {
        context: new HttpContext().set(SKIP_RETRY, true),
      })
      .pipe(map((body) => body.unreadCount));
  }

  override markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/read`, null);
  }

  override markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, null);
  }
}

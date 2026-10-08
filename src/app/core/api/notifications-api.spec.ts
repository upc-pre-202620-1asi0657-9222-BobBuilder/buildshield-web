import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';

import {TEST_ENV} from '../../../testing/test-helpers';
import {HTTP_INTERCEPTORS_IN_ORDER} from '../../app.config';
import {APP_ENV} from '../config/app-env';
import {NotificationPage} from '../models/notification';
import {HttpNotificationsApi} from './notifications-api';

describe('HttpNotificationsApi', () => {
  let api: HttpNotificationsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(HTTP_INTERCEPTORS_IN_ORDER)),
        provideHttpClientTesting(),
        {provide: APP_ENV, useValue: TEST_ENV},
        HttpNotificationsApi,
      ],
    });
    api = TestBed.inject(HttpNotificationsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la bandeja paginada', () => {
    let page: NotificationPage | undefined;
    api.list({unreadOnly: true, page: 1, size: 10}).subscribe((p) => (page = p));
    http
      .expectOne('/api/v1/notifications?unreadOnly=true&page=1&size=10')
      .flush({items: [], unreadCount: 0, page: 1, size: 10, total: 0});
    expect(page?.page).toBe(1);
  });

  it('usa valores por defecto en la bandeja', () => {
    api.list().subscribe();
    http.expectOne('/api/v1/notifications?unreadOnly=false&page=0&size=20').flush({items: []});
  });

  it('devuelve solo el número de no leídas', () => {
    let count: number | undefined;
    api.unreadCount().subscribe((c) => (count = c));
    http.expectOne('/api/v1/notifications/unread-count').flush({unreadCount: 4});
    expect(count).toBe(4);
  });

  it('marca una y todas como leídas', () => {
    api.markRead('n1').subscribe();
    const one = http.expectOne('/api/v1/notifications/n1/read');
    expect(one.request.method).toBe('POST');
    one.flush(null, {status: 204, statusText: 'No Content'});
    api.markAllRead().subscribe();
    http.expectOne('/api/v1/notifications/read-all').flush(null, {status: 204, statusText: 'No Content'});
  });
});

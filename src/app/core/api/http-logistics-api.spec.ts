import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';

import {TEST_ENV} from '../../../testing/test-helpers';
import {HTTP_INTERCEPTORS_IN_ORDER} from '../../app.config';
import {APP_ENV} from '../config/app-env';
import {ApiError} from '../http/api-error';
import {IDEMPOTENCY_HEADER} from '../http/idempotency.interceptor';
import {Reception} from '../models/logistics';
import {HttpLogisticsApi} from './http-logistics-api';

describe('HttpLogisticsApi', () => {
  let api: HttpLogisticsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(HTTP_INTERCEPTORS_IN_ORDER)),
        provideHttpClientTesting(),
        {provide: APP_ENV, useValue: TEST_ENV},
        HttpLogisticsApi,
      ],
    });
    api = TestBed.inject(HttpLogisticsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('abre la recepción existente si el backend responde RECEPTION_ALREADY_EXISTS', () => {
    let reception: Reception | undefined;
    api.openReception('d1').subscribe((r) => (reception = r));

    http.expectOne('/api/v1/receptions').flush(
      {
        code: 'RECEPTION_ALREADY_EXISTS',
        message: 'El despacho ya tiene una recepción',
        details: [{field: 'receptionId', message: 'r-existente'}],
      },
      {status: 409, statusText: 'Conflict'},
    );
    http.expectOne('/api/v1/receptions/r-existente').flush({id: 'r-existente', dispatchId: 'd1', lines: []});

    expect(reception?.id).toBe('r-existente');
  });

  it('propaga otros conflictos al abrir la recepción', () => {
    let error: ApiError | undefined;
    api.openReception('d1').subscribe({error: (e: ApiError) => (error = e)});
    http
      .expectOne('/api/v1/receptions')
      .flush({code: 'DISPATCH_NOT_IN_TRANSIT', message: 'No está en tránsito'}, {status: 409, statusText: 'Conflict'});
    expect(error?.code).toBe('DISPATCH_NOT_IN_TRANSIT');
  });

  it('crea el despacho con el Idempotency-Key indicado', () => {
    api.createDispatch({orderId: 'o1', lines: [{orderLineId: 'l1', quantity: 5}]}, 'clave-1').subscribe();
    const req = http.expectOne('/api/v1/dispatches');
    expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toBe('clave-1');
    expect(req.request.body).toEqual({orderId: 'o1', lines: [{orderLineId: 'l1', quantity: 5}]});
    req.flush({});
  });

  it('filtra los despachos por estado', () => {
    api.listDispatches({status: 'IN_TRANSIT'}).subscribe();
    http.expectOne('/api/v1/dispatches?status=IN_TRANSIT').flush([]);
  });
});

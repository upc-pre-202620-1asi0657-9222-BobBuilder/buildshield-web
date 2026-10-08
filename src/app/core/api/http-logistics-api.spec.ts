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

  describe('Sprint 3', () => {
    it('anula el despacho con motivo e Idempotency-Key', () => {
      api.cancelDispatch('d1', 'Pedido duplicado', 'clave-anular').subscribe();
      const req = http.expectOne('/api/v1/dispatches/d1/cancel');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({reason: 'Pedido duplicado'});
      expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toBe('clave-anular');
      req.flush({id: 'd1', status: 'CANCELLED'});
    });

    it('registra una incidencia y genera la clave si la pantalla no la pasa', () => {
      api.registerIncident('d1', {type: 'DELAY', observation: 'Tráfico en la Panamericana'}).subscribe();
      const req = http.expectOne('/api/v1/dispatches/d1/incidents');
      expect(req.request.body).toEqual({type: 'DELAY', observation: 'Tráfico en la Panamericana'});
      expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toBeTruthy();
      req.flush({id: 'i1'});
    });

    it('lista incidencias, consulta por manifiesto y la custodia', () => {
      api.listIncidents('d1').subscribe();
      http.expectOne('/api/v1/dispatches/d1/incidents').flush([]);
      api.getDispatchByManifest('MAN-20261103-7KQ2M9XA').subscribe();
      http.expectOne('/api/v1/dispatches/by-manifest/MAN-20261103-7KQ2M9XA').flush({id: 'd1'});
      api.getCustody('d1').subscribe();
      http.expectOne('/api/v1/dispatches/d1/custody').flush({dispatchId: 'd1', events: []});
    });

    it('abre la recepción por código de manifiesto', () => {
      api.openReceptionByManifest('MAN-1').subscribe();
      const req = http.expectOne('/api/v1/receptions');
      expect(req.request.body).toEqual({manifestCode: 'MAN-1'});
      req.flush({id: 'r1'});
    });

    it('guarda la recepción parcial con Idempotency-Key', () => {
      api.savePartialReception('r1', 'clave-parcial').subscribe();
      const req = http.expectOne('/api/v1/receptions/r1/partial');
      expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toBe('clave-parcial');
      req.flush({id: 'r1', status: 'PARTIALLY_RECEIVED'});
    });

    it('registra el pesaje de llegada', () => {
      api.registerArrivalWeighing('r1', {grossKg: 18000, tareKg: 8200, ticketPhotoUrl: null}).subscribe();
      const req = http.expectOne('/api/v1/receptions/r1/arrival-weighing');
      expect(req.request.body).toEqual({grossKg: 18000, tareKg: 8200, ticketPhotoUrl: null});
      req.flush({netKg: 9800});
    });

    it('filtra las discrepancias solo con los parámetros indicados', () => {
      api.listDiscrepancies({status: 'OPEN', dispatchId: 'd1'}).subscribe();
      http.expectOne('/api/v1/discrepancies?status=OPEN&dispatchId=d1').flush([]);
      api.listDiscrepancies().subscribe();
      http.expectOne('/api/v1/discrepancies').flush([]);
    });

    it('sube la evidencia como multipart con el campo file', () => {
      const file = new File(['x'], 'foto.jpg', {type: 'image/jpeg'});
      api.uploadEvidence('x1', file).subscribe();
      const req = http.expectOne('/api/v1/discrepancies/x1/evidences');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect((req.request.body as FormData).get('file')).toEqual(jasmine.any(File));
      expect(req.request.headers.has('Content-Type')).toBeFalse();
      req.flush({id: 'e1'});
    });

    it('envía cada acción de la discrepancia a su ruta', () => {
      api.respondDiscrepancy('x1', 'Se repone el lunes').subscribe();
      expect(http.expectOne('/api/v1/discrepancies/x1/response').request.body).toEqual({text: 'Se repone el lunes'});
      api.acceptDiscrepancy('x1').subscribe();
      expect(http.expectOne('/api/v1/discrepancies/x1/accept').request.body).toBeNull();
      api.escalateDiscrepancy('x1', 'No llegó').subscribe();
      expect(http.expectOne('/api/v1/discrepancies/x1/escalate').request.body).toEqual({reason: 'No llegó'});
      api.resolveDiscrepancy('x1', 'Nota de crédito').subscribe();
      expect(http.expectOne('/api/v1/discrepancies/x1/resolve').request.body).toEqual({decision: 'Nota de crédito'});
    });
  });
});

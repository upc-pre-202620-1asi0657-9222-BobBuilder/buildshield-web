import {HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {TEST_ENV, fakeSubscription} from '../../../testing/test-helpers';
import {HTTP_INTERCEPTORS_IN_ORDER} from '../../app.config';
import {SubscriptionApiService} from '../api/subscription-api.service';
import {APP_ENV} from '../config/app-env';
import {ApiError, toApiError} from '../http/api-error';
import {SubscriptionStateService, daysLeftLabel} from './subscription-state.service';

describe('SubscriptionStateService (US06 y US10)', () => {
  let api: jasmine.SpyObj<SubscriptionApiService>;

  function create(): SubscriptionStateService {
    TestBed.configureTestingModule({providers: [{provide: SubscriptionApiService, useValue: api}]});
    return TestBed.inject(SubscriptionStateService);
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<SubscriptionApiService>('SubscriptionApiService', ['current']);
  });

  it('avisa solo cuando quedan 3 días o menos de prueba', () => {
    api.current.and.returnValues(of(fakeSubscription({daysRemaining: 4})), of(fakeSubscription({daysRemaining: 3})));
    const state = create();
    state.refresh();
    expect(state.inTrial()).toBeTrue();
    expect(state.trialEndingSoon()).toBeFalse();
    state.refresh();
    expect(state.trialEndingSoon()).toBeTrue();
  });

  it('marca solo lectura por la consulta o por un 402 y lo limpia al pagar o al salir', () => {
    api.current.and.returnValue(of(fakeSubscription({status: 'EXPIRED', readOnly: true, daysRemaining: 0})));
    const state = create();
    state.refresh();
    expect(state.readOnly()).toBeTrue();
    expect(state.inTrial()).toBeFalse();

    state.set(fakeSubscription({status: 'ACTIVE', plan: 'PLUS', readOnly: false}));
    expect(state.readOnly()).toBeFalse();
    state.markReadOnly();
    expect(state.readOnly()).toBeTrue();
    state.clear();
    expect(state.readOnly()).toBeFalse();
    expect(state.subscription()).toBeNull();
  });

  it('conserva el último valor si la consulta falla', () => {
    api.current.and.returnValues(of(fakeSubscription({daysRemaining: 9})), throwError(() => new Error('red')));
    const state = create();
    state.refresh();
    state.refresh();
    expect(state.subscription()?.daysRemaining).toBe(9);
  });

  it('describe los días que quedan', () => {
    expect(daysLeftLabel(12)).toBe('Quedan 12 días');
    expect(daysLeftLabel(1)).toBe('Queda 1 día');
    expect(daysLeftLabel(0)).toBe('Último día');
  });
});

describe('readOnlyInterceptor (US10)', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let state: SubscriptionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(HTTP_INTERCEPTORS_IN_ORDER)),
        provideHttpClientTesting(),
        {provide: APP_ENV, useValue: TEST_ENV},
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(SubscriptionStateService);
  });

  afterEach(() => http.verify());

  it('ante 402 SUBSCRIPTION_READ_ONLY marca la cuenta y entrega el mensaje en español', () => {
    let error: ApiError | undefined;
    client.post('/api/v1/worksites', {}).subscribe({error: (e: ApiError) => (error = e)});
    http
      .expectOne('/api/v1/worksites')
      .flush({code: 'SUBSCRIPTION_READ_ONLY', message: 'x'}, {status: 402, statusText: 'Payment Required'});
    expect(state.readOnly()).toBeTrue();
    expect(error?.status).toBe(402);
    expect(error?.message).toContain('solo lectura');
  });

  it('otros errores no tocan el estado de la cuenta', () => {
    client.post('/api/v1/worksites', {}).subscribe({error: () => undefined});
    http
      .expectOne('/api/v1/worksites')
      .flush({code: 'WORKSITE_LIMIT_REACHED'}, {status: 409, statusText: 'Conflict'});
    expect(state.readOnly()).toBeFalse();
  });
});

describe('Mensajes de error del Sprint 4', () => {
  it('traduce los códigos de suscripción, inventario, reportes y destinatarios', () => {
    const expected: Record<string, string> = {
      WORKSITE_LIMIT_REACHED: 'plan Pro',
      SUBSCRIPTION_ALREADY_ACTIVE: 'plan pagado vigente',
      PAYMENT_GATEWAY_UNAVAILABLE: 'pasarela de pagos',
      COUNT_ALREADY_OPEN: 'conteo en curso',
      RETURN_EXCEEDS_BALANCE: 'saldo',
      REPORT_SCOPE_FORBIDDEN: 'asignados',
      RECIPIENT_NOT_ASSIGNED: 'no está asignado',
    };
    for (const [code, fragment] of Object.entries(expected)) {
      const error = toApiError(new HttpErrorResponse({status: 409, error: {code, message: 'backend'}}));
      expect(error.code).toBe(code);
      expect(error.message).toContain(fragment);
    }
  });
});

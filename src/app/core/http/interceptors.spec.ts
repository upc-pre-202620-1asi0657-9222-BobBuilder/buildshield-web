import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';

import {TEST_ENV, fakeJwt, fakeTokens} from '../../../testing/test-helpers';
import {HTTP_INTERCEPTORS_IN_ORDER} from '../../app.config';
import {AuthService, SESSION_STORAGE_KEY} from '../auth/auth.service';
import {APP_ENV} from '../config/app-env';
import {ApiError, toApiError} from './api-error';
import {RETRY_OBSERVER} from './http-context';
import {IDEMPOTENCY_HEADER} from './idempotency.interceptor';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Interceptores HTTP', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  function networkError(url: string): void {
    http.expectOne(url).error(new ProgressEvent('error'));
  }

  function signIn(): void {
    auth.signIn({email: 'ana@andina.pe', password: 'Segura123'}).subscribe();
    http.expectOne('/api/v1/auth/sign-in').flush(fakeTokens('WAREHOUSE_MANAGER'));
  }

  beforeEach(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
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
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(SESSION_STORAGE_KEY);
  });

  describe('authInterceptor', () => {
    it('agrega Authorization: Bearer a las peticiones de la API', () => {
      signIn();
      client.get('/api/v1/orders').subscribe();
      const req = http.expectOne('/api/v1/orders');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
      req.flush([]);
    });

    it('no agrega el token a URL externas', () => {
      signIn();
      client.get('https://example.com/data').subscribe();
      const req = http.expectOne('https://example.com/data');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('ante 401 renueva la sesión y repite la petición con el token nuevo', () => {
      signIn();
      let body: unknown;
      client.get('/api/v1/orders').subscribe((b) => (body = b));
      http.expectOne('/api/v1/orders').flush({}, {status: 401, statusText: 'Unauthorized'});

      const newAccess = fakeJwt('WAREHOUSE_MANAGER', 'user-1', 'org-2');
      http
        .expectOne('/api/v1/auth/refresh')
        .flush(fakeTokens('WAREHOUSE_MANAGER', {accessToken: newAccess, refreshToken: 'refresh-2'}));

      const retried = http.expectOne('/api/v1/orders');
      expect(retried.request.headers.get('Authorization')).toBe(`Bearer ${newAccess}`);
      retried.flush([{id: 'o1'}]);
      expect(body).toEqual([{id: 'o1'}]);
    });

    it('renueva antes de enviar si el token de acceso está por vencer', () => {
      auth.signIn({email: 'a@b.pe', password: 'Segura123'}).subscribe();
      http.expectOne('/api/v1/auth/sign-in').flush(fakeTokens('SITE_MANAGER', {}, 5_000));

      client.get('/api/v1/worksites').subscribe();
      http.expectOne('/api/v1/auth/refresh').flush(fakeTokens('SITE_MANAGER', {refreshToken: 'refresh-2'}));
      http.expectOne('/api/v1/worksites').flush([]);
      expect(auth.session()?.refreshToken).toBe('refresh-2');
    });

    it('si la renovación falla borra la sesión y lleva al inicio de sesión', () => {
      signIn();
      let error: ApiError | undefined;
      client.get('/api/v1/orders').subscribe({error: (e: ApiError) => (error = e)});
      http.expectOne('/api/v1/orders').flush({}, {status: 401, statusText: 'Unauthorized'});
      http
        .expectOne('/api/v1/auth/refresh')
        .flush({code: 'INVALID_REFRESH_TOKEN'}, {status: 401, statusText: 'Unauthorized'});

      expect(error).toEqual(jasmine.any(ApiError));
      expect(error?.status).toBe(401);
      expect(auth.session()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], {queryParams: {expired: 1}});
    });
  });

  describe('idempotencyInterceptor', () => {
    const cases: Array<[string, string]> = [
      ['/api/v1/stock/entries', 'entrada de stock'],
      ['/api/v1/orders', 'pedido'],
      ['/api/v1/orders/abc/approve', 'aprobación'],
      ['/api/v1/orders/abc/reject', 'rechazo'],
      ['/api/v1/dispatches', 'creación del despacho'],
      ['/api/v1/dispatches/abc/depart', 'salida del despacho'],
      ['/api/v1/receptions/abc/confirm', 'confirmación de recepción'],
    ];

    for (const [url, name] of cases) {
      it(`agrega un Idempotency-Key UUID a la ${name}`, () => {
        client.post(url, {}).subscribe();
        const req = http.expectOne(url);
        expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toMatch(UUID_PATTERN);
        req.flush({});
      });
    }

    it('no agrega la clave a otros POST ni a los GET', () => {
      client.post('/api/v1/users', {}).subscribe();
      client.get('/api/v1/orders').subscribe();
      client.post('/api/v1/receptions', {}).subscribe();
      for (const req of [
        http.expectOne('/api/v1/users'),
        http.expectOne({method: 'GET', url: '/api/v1/orders'}),
        http.expectOne('/api/v1/receptions'),
      ]) {
        expect(req.request.headers.has(IDEMPOTENCY_HEADER)).toBeFalse();
        req.flush({});
      }
    });

    it('respeta la clave que trae la petición', () => {
      const headers = new HttpHeaders({[IDEMPOTENCY_HEADER]: 'clave-propia'});
      client.post('/api/v1/orders', {}, {headers}).subscribe();
      const req = http.expectOne('/api/v1/orders');
      expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toBe('clave-propia');
      req.flush({});
    });

    it('genera claves distintas para operaciones distintas', () => {
      client.post('/api/v1/orders', {}).subscribe();
      client.post('/api/v1/orders', {}).subscribe();
      const [a, b] = http.match('/api/v1/orders');
      expect(a.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(
        b.request.headers.get(IDEMPOTENCY_HEADER),
      );
      a.flush({});
      b.flush({});
    });

    it('reusa la misma clave en los reintentos automáticos', fakeAsync(() => {
      client.post('/api/v1/receptions/r1/confirm', null).subscribe();
      const first = http.expectOne('/api/v1/receptions/r1/confirm');
      const key = first.request.headers.get(IDEMPOTENCY_HEADER);
      first.error(new ProgressEvent('error'));
      tick(TEST_ENV.retryBaseDelayMs);

      const second = http.expectOne('/api/v1/receptions/r1/confirm');
      expect(second.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
      second.flush({});
    }));
  });

  describe('retryInterceptor', () => {
    it('reintenta hasta 3 veces con espera exponencial ante fallas de red', fakeAsync(() => {
      let body: unknown;
      const attempts: number[] = [];
      client
        .get('/api/v1/materials', {context: new HttpContext().set(RETRY_OBSERVER, (n) => attempts.push(n))})
        .subscribe((b) => (body = b));

      networkError('/api/v1/materials');
      tick(99);
      http.expectNone('/api/v1/materials');
      tick(1);
      networkError('/api/v1/materials');
      tick(200);
      networkError('/api/v1/materials');
      tick(400);
      http.expectOne('/api/v1/materials').flush([{id: 'm1'}]);

      expect(attempts).toEqual([1, 2, 3]);
      expect(body).toEqual([{id: 'm1'}]);
    }));

    it('se rinde después del tercer reintento con un mensaje en español', fakeAsync(() => {
      let error: ApiError | undefined;
      client.get('/api/v1/materials').subscribe({error: (e: ApiError) => (error = e)});
      networkError('/api/v1/materials');
      tick(100);
      networkError('/api/v1/materials');
      tick(200);
      networkError('/api/v1/materials');
      tick(400);
      networkError('/api/v1/materials');

      expect(error?.code).toBe('NETWORK_ERROR');
      expect(error?.message).toContain('No hay conexión');
    }));

    it('reintenta el PUT de una línea de recepción (idempotente)', fakeAsync(() => {
      let saved = false;
      client.put('/api/v1/receptions/r1/lines/l1', {receivedQty: 5}).subscribe(() => (saved = true));
      networkError('/api/v1/receptions/r1/lines/l1');
      tick(100);
      const retried = http.expectOne('/api/v1/receptions/r1/lines/l1');
      expect(retried.request.body).toEqual({receivedQty: 5});
      retried.flush({});
      expect(saved).toBeTrue();
    }));

    it('no reintenta un POST sin Idempotency-Key', fakeAsync(() => {
      let error: ApiError | undefined;
      client.post('/api/v1/users', {}).subscribe({error: (e: ApiError) => (error = e)});
      networkError('/api/v1/users');
      tick(1000);
      http.expectNone('/api/v1/users');
      expect(error?.code).toBe('NETWORK_ERROR');
    }));

    it('no reintenta errores de negocio', fakeAsync(() => {
      let error: ApiError | undefined;
      client.get('/api/v1/orders/x').subscribe({error: (e: ApiError) => (error = e)});
      http.expectOne('/api/v1/orders/x').flush({code: 'NOT_FOUND', message: ''}, {status: 404, statusText: 'NF'});
      tick(1000);
      http.expectNone('/api/v1/orders/x');
      expect(error?.status).toBe(404);
    }));
  });

  describe('errorInterceptor', () => {
    function failWith(body: object | string | null, status: number): ApiError | undefined {
      let error: ApiError | undefined;
      client.post('/api/v1/users', {}).subscribe({error: (e: ApiError) => (error = e)});
      http.expectOne('/api/v1/users').flush(body, {status, statusText: 'x'});
      return error;
    }

    it('traduce códigos conocidos del backend', () => {
      const error = failWith({code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock'}, 409);
      expect(error).toEqual(jasmine.any(ApiError));
      expect(error?.code).toBe('INSUFFICIENT_STOCK');
      expect(error?.message).toContain('No hay stock suficiente');
    });

    it('usa el mensaje del backend para códigos no mapeados y conserva los detalles', () => {
      const error = failWith(
        {code: 'INVALID_EMAIL', message: 'El correo no es válido', details: [{field: 'email', message: 'formato'}]},
        400,
      );
      expect(error?.message).toBe('El correo no es válido');
      expect(error?.details).toEqual([{field: 'email', message: 'formato'}]);
    });

    it('usa un mensaje por código HTTP si no hay cuerpo', () => {
      expect(failWith(null, 403)?.message).toBe('No tienes permiso para realizar esta acción.');
      expect(failWith('', 500)?.message).toBe('Ocurrió un error en el servidor. Inténtalo más tarde.');
    });

    it('toApiError es idempotente', () => {
      const error = new ApiError(409, 'X', 'mensaje');
      expect(toApiError(error)).toBe(error);
    });
  });
});

import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';

import {TEST_ENV, fakeJwt, fakeTokens} from '../../../testing/test-helpers';
import {HTTP_INTERCEPTORS_IN_ORDER} from '../../app.config';
import {APP_ENV} from '../config/app-env';
import {ApiError} from '../http/api-error';
import {Session} from '../models/auth';
import {AuthService, SESSION_STORAGE_KEY} from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(HTTP_INTERCEPTORS_IN_ORDER)),
        provideHttpClientTesting(),
        {provide: APP_ENV, useValue: TEST_ENV},
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  function signIn(role: 'ADMINISTRATOR' | 'WAREHOUSE_MANAGER' | 'SITE_MANAGER' = 'SITE_MANAGER') {
    let session: Session | undefined;
    service.signIn({email: 'ana@andina.pe', password: 'Segura123'}).subscribe((s) => (session = s));
    http.expectOne('/api/v1/auth/sign-in').flush(fakeTokens(role));
    return session;
  }

  beforeEach(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setup();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(SESSION_STORAGE_KEY);
  });

  it('inicia sesión, lee el rol del JWT y guarda la sesión', () => {
    const session = signIn('WAREHOUSE_MANAGER');

    expect(session?.role).toBe('WAREHOUSE_MANAGER');
    expect(session?.userId).toBe('user-1');
    expect(session?.organizationId).toBe('org-1');
    expect(service.role()).toBe('WAREHOUSE_MANAGER');
    expect(service.isAuthenticated()).toBeTrue();
    const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}') as Session;
    expect(stored.refreshToken).toBe('refresh-1');
  });

  it('no envía Authorization en el inicio de sesión', () => {
    service.signIn({email: 'ana@andina.pe', password: 'x'}).subscribe();
    const req = http.expectOne('/api/v1/auth/sign-in');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.body).toEqual({email: 'ana@andina.pe', password: 'x'});
    req.flush(fakeTokens('ADMINISTRATOR'));
  });

  it('traduce credenciales inválidas a un mensaje en español', () => {
    let error: ApiError | undefined;
    service.signIn({email: 'a@b.pe', password: 'mala'}).subscribe({error: (e: ApiError) => (error = e)});
    http
      .expectOne('/api/v1/auth/sign-in')
      .flush({code: 'INVALID_CREDENTIALS', message: 'x'}, {status: 401, statusText: 'Unauthorized'});
    expect(error?.message).toBe('Correo o contraseña incorrectos.');
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('rota el token de renovación al refrescar', () => {
    signIn();
    let refreshed: Session | undefined;
    service.refresh().subscribe((s) => (refreshed = s));

    const req = http.expectOne('/api/v1/auth/refresh');
    expect(req.request.body).toEqual({refreshToken: 'refresh-1'});
    req.flush(fakeTokens('SITE_MANAGER', {refreshToken: 'refresh-2', accessToken: fakeJwt('SITE_MANAGER', 'user-1')}));

    expect(refreshed?.refreshToken).toBe('refresh-2');
    expect(service.session()?.refreshToken).toBe('refresh-2');
  });

  it('comparte una sola renovación entre llamadas simultáneas', () => {
    signIn();
    const results: string[] = [];
    service.refresh().subscribe((s) => results.push(s.refreshToken));
    service.refresh().subscribe((s) => results.push(s.refreshToken));

    http.expectOne('/api/v1/auth/refresh').flush(fakeTokens('SITE_MANAGER', {refreshToken: 'refresh-2'}));

    expect(results).toEqual(['refresh-2', 'refresh-2']);
  });

  it('borra la sesión si la renovación es rechazada', () => {
    signIn();
    let failed = false;
    service.refresh().subscribe({error: () => (failed = true)});
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({code: 'INVALID_REFRESH_TOKEN', message: 'x'}, {status: 401, statusText: 'Unauthorized'});

    expect(failed).toBeTrue();
    expect(service.session()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('cierra sesión enviando el token de renovación', () => {
    signIn();
    let done = false;
    service.signOut().subscribe(() => (done = true));

    const req = http.expectOne('/api/v1/auth/sign-out');
    expect(req.request.body).toEqual({refreshToken: 'refresh-1'});
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
    req.flush(null, {status: 204, statusText: 'No Content'});

    expect(done).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('cierra la sesión local aunque el backend falle', () => {
    signIn();
    service.signOut().subscribe();
    http.expectOne('/api/v1/auth/sign-out').flush({}, {status: 500, statusText: 'Error'});
    expect(service.session()).toBeNull();
  });

  it('detecta cuando el token de acceso está por vencer', () => {
    service.signIn({email: 'a@b.pe', password: 'Segura123'}).subscribe();
    http.expectOne('/api/v1/auth/sign-in').flush(fakeTokens('SITE_MANAGER', {}, 10_000));
    expect(service.accessTokenExpiresSoon()).toBeTrue();
    expect(service.accessTokenExpiresSoon(Date.now() - 60_000)).toBeFalse();
  });

  it('restaura la sesión guardada al iniciar', () => {
    signIn('ADMINISTRATOR');
    TestBed.resetTestingModule();
    setup();
    expect(service.role()).toBe('ADMINISTRATOR');
    expect(service.hasAnyRole(['ADMINISTRATOR'])).toBeTrue();
    expect(service.hasAnyRole(['SITE_MANAGER'])).toBeFalse();
  });
});

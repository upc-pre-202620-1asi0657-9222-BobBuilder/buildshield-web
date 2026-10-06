import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {ApplicationConfig, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import {registerLocaleData} from '@angular/common';
import localeEsPe from '@angular/common/locales/es-PE';
import {provideRouter, withComponentInputBinding} from '@angular/router';

import {routes} from './app.routes';
import {provideLogisticsApi} from './core/api/logistics-api.provider';
import {authInterceptor} from './core/http/auth.interceptor';
import {errorInterceptor} from './core/http/error.interceptor';
import {idempotencyInterceptor} from './core/http/idempotency.interceptor';
import {retryInterceptor} from './core/http/retry.interceptor';

registerLocaleData(localeEsPe);

/**
 * Orden de interceptores (el primero envuelve a los demás):
 * 1. idempotency: asigna la clave una sola vez, antes de cualquier reintento.
 * 2. error: traduce el error final a ApiError en español.
 * 3. auth: agrega el token y renueva la sesión ante 401.
 * 4. retry: tiempo máximo y reintentos con espera exponencial.
 */
export const HTTP_INTERCEPTORS_IN_ORDER = [
  idempotencyInterceptor,
  errorInterceptor,
  authInterceptor,
  retryInterceptor,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors(HTTP_INTERCEPTORS_IN_ORDER)),
    provideLogisticsApi(),
    {provide: LOCALE_ID, useValue: 'es-PE'},
  ],
};

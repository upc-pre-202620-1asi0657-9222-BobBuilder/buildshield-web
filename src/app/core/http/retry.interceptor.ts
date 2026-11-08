import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {retry, throwError, timeout, timer} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {isTransientNetworkError} from './api-error';
import {RETRY_OBSERVER, SKIP_RETRY} from './http-context';
import {IDEMPOTENCY_HEADER} from './idempotency.interceptor';

const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/**
 * Aplica un tiempo máximo por intento y reintenta con espera exponencial
 * (base, 2x base, 4x base) hasta maxNetworkRetries veces, solo ante fallas de
 * red o tiempo agotado y solo en peticiones idempotentes: métodos seguros, PUT,
 * DELETE o POST con Idempotency-Key.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(APP_ENV);
  const attempt$ = next(req).pipe(timeout(env.requestTimeoutMs));
  const retriable =
    !req.context.get(SKIP_RETRY) &&
    (IDEMPOTENT_METHODS.has(req.method) || req.headers.has(IDEMPOTENCY_HEADER));
  if (!retriable || env.maxNetworkRetries <= 0) {
    return attempt$;
  }
  const observer = req.context.get(RETRY_OBSERVER);
  return attempt$.pipe(
    retry({
      count: env.maxNetworkRetries,
      delay: (error: unknown, retryCount: number) => {
        if (!isTransientNetworkError(error)) {
          return throwError(() => error);
        }
        observer?.(retryCount);
        return timer(env.retryBaseDelayMs * 2 ** (retryCount - 1));
      },
    }),
  );
};

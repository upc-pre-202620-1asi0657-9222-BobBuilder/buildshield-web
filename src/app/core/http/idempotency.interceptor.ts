import {HttpInterceptorFn, HttpRequest} from '@angular/common/http';

import {generateUuid} from '../util/uuid';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** POST que el backend exige con Idempotency-Key. */
const IDEMPOTENT_POST_PATHS: readonly RegExp[] = [
  /\/stock\/entries$/,
  /\/orders$/,
  /\/orders\/[^/]+\/(approve|reject)$/,
  /\/dispatches$/,
  /\/dispatches\/[^/]+\/depart$/,
  /\/receptions\/[^/]+\/confirm$/,
];

export function requiresIdempotencyKey(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'POST') {
    return false;
  }
  const path = req.url.split('?')[0].replace(/\/+$/, '');
  return IDEMPOTENT_POST_PATHS.some((pattern) => pattern.test(path));
}

/**
 * Agrega un Idempotency-Key UUID a los POST que lo exigen. Si la petición ya
 * trae uno (por ejemplo, porque el usuario reintenta la misma operación), se
 * respeta. Este interceptor va antes del de reintentos, así que los reintentos
 * automáticos reenvían exactamente la misma clave.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!requiresIdempotencyKey(req) || req.headers.has(IDEMPOTENCY_HEADER)) {
    return next(req);
  }
  return next(req.clone({setHeaders: {[IDEMPOTENCY_HEADER]: generateUuid()}}));
};

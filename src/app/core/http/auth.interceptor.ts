import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {Observable, catchError, switchMap, throwError} from 'rxjs';

import {AuthService} from '../auth/auth.service';
import {APP_ENV} from '../config/app-env';
import {ApiError} from './api-error';
import {SKIP_AUTH} from './http-context';

function withBearer<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}}) : req;
}

function isUnauthorized(error: unknown): boolean {
  return (
    (error instanceof HttpErrorResponse || error instanceof ApiError) && error.status === 401
  );
}

/**
 * Agrega Authorization: Bearer a las peticiones de la API. Si el token de
 * acceso está por vencer lo renueva antes; si el backend responde 401, renueva
 * una vez (rotación del token de renovación) y repite la petición. Si la
 * renovación falla, borra la sesión y lleva al inicio de sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(APP_ENV);
  if (req.context.get(SKIP_AUTH) || !req.url.startsWith(env.apiBaseUrl)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  const send = () => next(withBearer(req, auth.accessToken()));
  const goToSignIn = () => {
    auth.clearSession();
    void router.navigate(['/sign-in'], {queryParams: {expired: 1}});
  };

  const first$: Observable<HttpEvent<unknown>> =
    auth.accessToken() && auth.accessTokenExpiresSoon()
      ? auth.refresh().pipe(switchMap(() => send()))
      : send();

  let refreshed = false;
  return first$.pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      if (refreshed || auth.session() === null) {
        goToSignIn();
        return throwError(() => error);
      }
      refreshed = true;
      return auth.refresh().pipe(
        catchError(() => {
          goToSignIn();
          return throwError(() => error);
        }),
        switchMap(() => send()),
      );
    }),
  );
};

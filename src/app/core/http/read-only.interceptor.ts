import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, throwError} from 'rxjs';

import {SubscriptionStateService} from '../subscription/subscription-state.service';
import {ApiError} from './api-error';

export const READ_ONLY_CODE = 'SUBSCRIPTION_READ_ONLY';

/**
 * US10: cuando el gateway o un servicio responde 402 SUBSCRIPTION_READ_ONLY,
 * marca la cuenta en solo lectura para mostrar el aviso persistente. El error
 * sigue su camino: la pantalla que intentó escribir muestra el mensaje.
 * Va antes del interceptor de errores, así recibe el ApiError ya traducido.
 */
export const readOnlyInterceptor: HttpInterceptorFn = (req, next) => {
  const state = inject(SubscriptionStateService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError && error.status === 402 && error.code === READ_ONLY_CODE) {
        state.markReadOnly();
      }
      return throwError(() => error);
    }),
  );
};

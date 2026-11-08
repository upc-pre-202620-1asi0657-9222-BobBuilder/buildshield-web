import {HttpInterceptorFn} from '@angular/common/http';
import {catchError, throwError} from 'rxjs';

import {toApiError} from './api-error';

/** Convierte toda respuesta de error en ApiError con mensaje en español. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));

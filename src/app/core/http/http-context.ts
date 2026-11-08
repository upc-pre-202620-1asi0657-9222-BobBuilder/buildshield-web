import {HttpContextToken} from '@angular/common/http';

/** Callback que recibe el número de reintento en curso (1, 2, 3). */
export type RetryObserver = (attempt: number) => void;

/**
 * Permite a un componente enterarse de que su petición se está reintentando,
 * por ejemplo para mostrar «reintentando» en una línea de la recepción.
 */
export const RETRY_OBSERVER = new HttpContextToken<RetryObserver | null>(() => null);

/** Desactiva los reintentos automáticos para una petición concreta. */
export const SKIP_RETRY = new HttpContextToken<boolean>(() => false);

/** Marca peticiones que no deben pasar por el manejo de sesión (sign-in, refresh...). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

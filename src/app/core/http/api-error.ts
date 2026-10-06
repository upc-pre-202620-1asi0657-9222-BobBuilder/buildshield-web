import {HttpErrorResponse} from '@angular/common/http';
import {TimeoutError} from 'rxjs';

/** Detalle por campo que devuelve el backend en errores de validación. */
export interface ApiErrorDetail {
  field: string | null;
  message: string;
}

/** Error de la API ya traducido a un mensaje en español para mostrar al usuario. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Mensajes por código de error de buildshield-core. */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  INVALID_REFRESH_TOKEN: 'Tu sesión venció. Vuelve a iniciar sesión.',
  INVALID_TOKEN: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
  EMAIL_ALREADY_REGISTERED: 'Ese correo ya está registrado.',
  RUC_ALREADY_REGISTERED: 'Ese RUC ya está registrado.',
  INVALID_RUC: 'El RUC debe tener 11 dígitos.',
  WEAK_PASSWORD: 'La contraseña debe tener de 8 a 72 caracteres, con al menos una letra y un número.',
  INSUFFICIENT_STOCK: 'No hay stock suficiente en el almacén para atender esa cantidad.',
  DISPATCH_EXCEEDS_PENDING: 'La cantidad despachada supera lo pendiente del pedido.',
  INVALID_ORDER_TRANSITION: 'El pedido ya no está en un estado que permita esa acción.',
  IDEMPOTENCY_IN_PROGRESS: 'La operación anterior aún se está procesando. Espera unos segundos.',
  IDEMPOTENCY_KEY_REUSED: 'La operación ya se envió con otros datos. Recarga la página.',
  CONCURRENT_MODIFICATION: 'Otro usuario modificó este registro. Recarga e inténtalo de nuevo.',
  DUPLICATE_MATERIAL: 'Un material no puede repetirse en el mismo pedido.',
  SKU_ALREADY_REGISTERED: 'Ese SKU ya existe en la organización.',
  INVALID_WASTE_TOLERANCE: 'La tolerancia de merma debe estar entre 0 y 100.',
  INVALID_DATE_RANGE: 'La fecha de fin no puede ser anterior a la de inicio.',
};

/** Mensajes genéricos por código HTTP cuando el backend no envía uno propio. */
const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Revisa los datos ingresados.',
  401: 'Tu sesión venció. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con el estado actual. Recarga e inténtalo de nuevo.',
  422: 'La operación no cumple las reglas del negocio.',
  429: 'Demasiadas solicitudes. Espera un momento.',
  500: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
  502: 'El servidor no está disponible. Inténtalo más tarde.',
  503: 'El servidor no está disponible. Inténtalo más tarde.',
  504: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
};

const DEFAULT_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

interface BackendErrorBody {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function isBackendErrorBody(value: unknown): value is BackendErrorBody {
  return typeof value === 'object' && value !== null && ('code' in value || 'message' in value);
}

function readDetails(raw: unknown): ApiErrorDetail[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((d): d is {field?: unknown; message?: unknown} => typeof d === 'object' && d !== null)
    .map((d) => ({
      field: typeof d.field === 'string' ? d.field : null,
      message: typeof d.message === 'string' ? d.message : '',
    }));
}

/** Convierte cualquier error HTTP (o de tiempo agotado) en un ApiError con mensaje en español. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TimeoutError) {
    return new ApiError(0, 'TIMEOUT', CODE_MESSAGES['TIMEOUT']);
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, 'UNKNOWN', DEFAULT_MESSAGE);
  }
  if (error.status === 0) {
    return new ApiError(0, 'NETWORK_ERROR', CODE_MESSAGES['NETWORK_ERROR']);
  }
  const body: unknown = error.error;
  if (isBackendErrorBody(body)) {
    const code = typeof body.code === 'string' ? body.code : `HTTP_${error.status}`;
    const backendMessage = typeof body.message === 'string' ? body.message.trim() : '';
    const message =
      CODE_MESSAGES[code] ||
      backendMessage ||
      STATUS_MESSAGES[error.status] ||
      DEFAULT_MESSAGE;
    return new ApiError(error.status, code, message, readDetails(body.details));
  }
  return new ApiError(
    error.status,
    `HTTP_${error.status}`,
    STATUS_MESSAGES[error.status] ?? DEFAULT_MESSAGE,
  );
}

/** Indica si el error es transitorio de red (sin respuesta, tiempo agotado o gateway). */
export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 || error.status === 408 || error.status === 502 ||
      error.status === 503 || error.status === 504;
  }
  return false;
}

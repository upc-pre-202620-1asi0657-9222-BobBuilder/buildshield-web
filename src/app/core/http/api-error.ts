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
  INSUFFICIENT_STOCK:
    'No hay stock suficiente en el almacén para reservar el pedido. Registra una entrada de stock e inténtalo de nuevo.',
  RECEPTION_ALREADY_EXISTS: 'El despacho ya tiene una recepción abierta.',
  TOKEN_REVOKED: 'Tu sesión fue cerrada porque cambió tu usuario. Vuelve a iniciar sesión.',
  DISPATCH_EXCEEDS_PENDING: 'La cantidad despachada supera lo pendiente del pedido.',
  INVALID_ORDER_TRANSITION: 'El pedido ya no está en un estado que permita esa acción.',
  IDEMPOTENCY_IN_PROGRESS: 'La operación anterior aún se está procesando. Espera unos segundos.',
  IDEMPOTENCY_KEY_REUSED: 'La operación ya se envió con otros datos. Recarga la página.',
  CONCURRENT_MODIFICATION: 'Otro usuario modificó este registro. Recarga e inténtalo de nuevo.',
  DUPLICATE_MATERIAL: 'Un material no puede repetirse en el mismo pedido.',
  SKU_ALREADY_REGISTERED: 'Ese SKU ya existe en la organización.',
  INVALID_WASTE_TOLERANCE: 'La tolerancia de merma debe estar entre 0 y 100.',
  INVALID_DATE_RANGE: 'La fecha de fin no puede ser anterior a la de inicio.',
  // Sprint 4: suscripción y pagos.
  SUBSCRIPTION_READ_ONLY:
    'La cuenta está en solo lectura porque venció la suscripción. Puedes consultar todo, pero no registrar cambios hasta pagar un plan.',
  WORKSITE_LIMIT_REACHED:
    'El plan Plus permite hasta 5 obras activas. Pasa al plan Pro para registrar o reactivar más obras.',
  SUBSCRIPTION_ALREADY_ACTIVE: 'La organización ya tiene un plan pagado vigente.',
  PLAN_NOT_PAYABLE: 'Ese plan no se puede pagar: elige Plus o Pro.',
  PAYMENT_GATEWAY_UNAVAILABLE: 'La pasarela de pagos no responde. Inténtalo en unos minutos.',
  PAYMENT_SIMULATION_DISABLED: 'El pago simulado no está habilitado en este entorno.',
  SUBSCRIPTION_NOT_ACTIVE: 'El cambio de modalidad requiere un plan pagado vigente.',
  SUBSCRIPTION_NOT_FOUND: 'La suscripción todavía se está creando. Espera unos segundos y recarga.',
  CHECKOUT_NOT_FOUND: 'La sesión de pago no existe o ya venció. Vuelve a elegir el plan.',
  // Sprint 4: inventario, conteos y devoluciones.
  INITIAL_STOCK_ALREADY_REGISTERED:
    'Ese material ya tiene inventario inicial en el almacén. Regístralo como reposición.',
  COUNT_ALREADY_OPEN: 'El almacén ya tiene un conteo en curso. Termínalo o anúlalo antes de empezar otro.',
  COUNT_MODIFIED: 'Otro usuario modificó este conteo. Recarga e inténtalo de nuevo.',
  COUNT_NOT_REVIEWED: 'Revisa las diferencias antes de validar el ajuste.',
  RETURN_EXCEEDS_BALANCE: 'La cantidad supera el saldo que la obra puede devolver.',
  ORIGIN_WAREHOUSE_REQUIRED: 'El material llegó de varios almacenes: elige a cuál se devuelve.',
  NOT_SUPPLIED_BY_WAREHOUSE: 'Ese almacén no despachó el material a la obra.',
  ORIGIN_WAREHOUSE_UNKNOWN: 'No hay registro del almacén que despachó el material a la obra.',
  NO_COMMON_ORIGIN_WAREHOUSE:
    'Los materiales vienen de almacenes distintos. Registra una devolución por almacén.',
  RETURN_MODIFIED: 'Otro usuario modificó esta devolución. Recarga e inténtalo de nuevo.',
  RETURN_FORBIDDEN: 'Tu rol no puede realizar ese paso de la devolución.',
  // Sprint 4: reportes y destinatarios.
  REPORT_SCOPE_FORBIDDEN: 'Solo puedes consultar el reporte de tus obras o almacenes asignados.',
  INVALID_PERIOD: 'La fecha de inicio no puede ser posterior a la de fin.',
  UNSUPPORTED_FORMAT: 'Formato de exportación no soportado.',
  UNKNOWN_RECIPIENT: 'Uno de los usuarios elegidos no existe o está desactivado.',
  RECIPIENT_NOT_ASSIGNED: 'Un encargado de obra elegido no está asignado a esta obra.',
  TOO_MANY_RECIPIENTS: 'Se pueden elegir hasta 50 destinatarios por aviso.',
};

/** Mensajes genéricos por código HTTP cuando el backend no envía uno propio. */
const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Revisa los datos ingresados.',
  401: 'Tu sesión venció. Vuelve a iniciar sesión.',
  402: 'La cuenta está en solo lectura hasta pagar un plan.',
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

/**
 * Indica si conviene reusar el Idempotency-Key al reintentar: sí ante fallas
 * de red o del servidor (la operación pudo aplicarse); no ante un rechazo de
 * negocio (4xx), porque el backend repetiría la misma respuesta guardada.
 */
export function shouldReuseIdempotencyKey(error: ApiError): boolean {
  return error.status === 0 || error.status >= 500;
}

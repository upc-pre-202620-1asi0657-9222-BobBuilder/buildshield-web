/** Forma de la configuración por entorno. */
export interface Environment {
  readonly production: boolean;
  /** Prefijo de la API REST de buildshield-core, por ejemplo `/api/v1`. */
  readonly apiBaseUrl: string;
  /** Tiempo máximo por intento de una petición HTTP. */
  readonly requestTimeoutMs: number;
  /** Reintentos ante fallas de red o tiempo agotado (solo peticiones idempotentes). */
  readonly maxNetworkRetries: number;
  /** Base de la espera exponencial entre reintentos. */
  readonly retryBaseDelayMs: number;
  /** Simula los endpoints de despachos y recepciones del Sprint 2. */
  readonly mockSprint2: boolean;
}

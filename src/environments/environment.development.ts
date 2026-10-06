import {Environment} from './environment.model';

/**
 * Configuración de desarrollo. Las URL son relativas: `ng serve` usa
 * proxy.conf.json para enviar /api a http://localhost:8080 y evitar CORS.
 *
 * mockSprint2 simula en memoria los endpoints de despachos y recepciones
 * mientras el backend del Sprint 2 no esté disponible.
 */
export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  requestTimeoutMs: 15000,
  maxNetworkRetries: 3,
  retryBaseDelayMs: 500,
  mockSprint2: true,
};

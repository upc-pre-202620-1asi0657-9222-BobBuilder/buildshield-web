# BuildShield Web

Aplicación web de **BuildShield**, el SaaS B2B multiempresa de trazabilidad de materiales entre almacén y obra: pedidos, despachos con manifiesto y QR, y recepción en obra con comparación de lo despachado contra lo recibido para calcular la merma frente a la tolerancia de cada material.

Backend: [`buildshield-core`](../buildshield-core) (Spring Boot, `http://localhost:8080`, OpenAPI en `/api/v1/api-docs`, Swagger en `/swagger-ui.html`).

## Stack

- Angular 18 con componentes standalone, señales y el nuevo control de flujo (`@if`, `@for`).
- TypeScript 5.5 en modo estricto, guía de estilo de Google para TypeScript.
- SCSS propio, sin librería de componentes: mobile-first, objetivos táctiles de 48 px.
- RxJS 7 e `HttpClient` con interceptores funcionales.
- Pruebas unitarias con Jasmine y Karma (ChromeHeadless).

## Requisitos

- Node.js 18.19 o superior (probado con Node 24) y npm 10 o superior.
- Google Chrome para las pruebas (`CHROME_BIN`).
- `buildshield-core` corriendo en `http://localhost:8080` para usar datos reales.

## Cómo ejecutar

```bash
npm install
npm start            # ng serve en http://localhost:4200 con proxy /api -> http://localhost:8080
```

En desarrollo las URL de la API son relativas (`/api/v1`) y `proxy.conf.json` las envía al backend, así no hace falta configurar CORS.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm start` | Servidor de desarrollo con proxy al backend. |
| `npm run build` | Build de producción en `dist/buildshield-web`. |
| `npm run build:dev` | Build de desarrollo (usa `environment.development.ts`). |
| `npm test` | Pruebas en modo observador. |
| `npm run test:ci` | Pruebas una sola vez en ChromeHeadless. |

En Windows, antes de las pruebas:

```bash
export CHROME_BIN="C:/Program Files/Google/Chrome/Application/chrome.exe"   # Git Bash
$env:CHROME_BIN = "C:/Program Files/Google/Chrome/Application/chrome.exe"   # PowerShell
```

## Entorno

`src/environments/environment.ts` (producción) y `environment.development.ts` (desarrollo, lo reemplaza en `ng serve` y `build:dev`).

| Variable | Desarrollo | Producción | Uso |
| --- | --- | --- | --- |
| `apiBaseUrl` | `/api/v1` | `/api/v1` | Prefijo de la API. En producción se espera el mismo dominio o un proxy inverso. |
| `requestTimeoutMs` | 15000 | 15000 | Tiempo máximo por intento. |
| `maxNetworkRetries` | 3 | 3 | Reintentos ante fallas de red o tiempo agotado. |
| `retryBaseDelayMs` | 500 | 500 | Espera exponencial: 500, 1000 y 2000 ms. |
| `mockSprint2` | `true` | `false` | Simula en el navegador los endpoints de despachos y recepciones del Sprint 2. |

### Modo simulado del Sprint 2

Mientras `buildshield-core` no publique `/dispatches` y `/receptions`, `mockSprint2: true` cambia la implementación de `LogisticsApi` por `MockLogisticsApi`: guarda despachos y recepciones en `localStorage` (`buildshield.mock.logistics`), siembra un despacho de demostración en tránsito y dibuja un QR de muestra (no escaneable) para el manifiesto. Los pedidos, el catálogo y la sesión siempre van al backend real. La interfaz muestra un aviso amarillo mientras el modo está activo. Para usar el backend real basta con poner `mockSprint2: false`.

## Pantallas y tareas del sprint

| Ruta | Rol | Tarea |
| --- | --- | --- |
| `/sign-up` | Público | T06 registro de organización (razón social, RUC de 11 dígitos, administrador, contraseña de 8 a 72 caracteres con letra y número). |
| `/sign-in` | Público | T08 inicio de sesión con redirección por rol. |
| `/users` | Administrador | T12 lista y alta de usuarios con rol, y asignación a obra o almacén. |
| `/worksites`, `/warehouses`, `/materials` | Todos (alta: administrador) | T16 catálogo; material con SKU, unidad y tolerancia de 0 a 100. |
| `/stock` | Administrador, almacén | Existencias y entradas de stock. |
| `/orders`, `/orders/new`, `/orders/:id` | Todos (alta: obra; aprobar o rechazar: almacén) | T19 pedido con obra, almacén, fecha requerida y líneas; lista y detalle con estado. |
| `/dispatches`, `/dispatches/new`, `/dispatches/:id` | Administrador, almacén | Despacho desde un pedido aprobado, transportista, pesaje de salida y salida. |
| `/dispatches/:id/manifest` | Con sesión | T32 manifiesto imprimible con QR. |
| `/reception`, `/reception/:dispatchId` | Encargado de obra | T37 recepción móvil con comparación y guardado progresivo. |

Inicio por rol: administrador en `/users`, encargado de almacén en `/dispatches`, encargado de obra en `/reception`.

### Recepción en obra (T37, RNF20 y RNF21)

Flujo estándar en 2 interacciones (el límite es 5): tocar el despacho en tránsito y tocar «Confirmar recepción». Las cantidades recibidas llegan precargadas con lo despachado y se guardan solas; si algo llegó distinto se corrige solo esa línea, que se guarda al salir del campo. Cada línea muestra su estado (pendiente, guardando, guardado, reintentando o no se guardó con botón de reintento). Todos los controles miden al menos 48 px y el botón de confirmar queda fijo abajo, al alcance del pulgar.

## Base técnica (T40)

- `AuthService`: sesión en señales y `localStorage`, rol leído del JWT (`role`, `org`, `sub`), renovación con rotación del token y una sola petición de renovación compartida entre llamadas simultáneas.
- Interceptores, en este orden:
  1. `idempotencyInterceptor`: agrega `Idempotency-Key` UUID a `POST /stock/entries`, `/orders`, `/orders/{id}/approve`, `/orders/{id}/reject`, `/dispatches/{id}/depart` y `/receptions/{id}/confirm`. Respeta la clave si la petición ya trae una (las pantallas reusan la suya cuando el usuario reintenta la misma operación).
  2. `errorInterceptor`: convierte toda falla en `ApiError` con mensaje en español (por código del backend, por mensaje del backend o por estado HTTP).
  3. `authInterceptor`: agrega `Authorization: Bearer`, renueva antes de que venza el token y, ante 401, renueva una vez y repite; si falla, cierra la sesión y lleva a `/sign-in`.
  4. `retryInterceptor`: tiempo máximo por intento y hasta 3 reintentos con espera exponencial ante fallas de red, solo en peticiones idempotentes (GET, PUT, DELETE o POST con `Idempotency-Key`). Como va después del de idempotencia, cada reintento reenvía la misma clave.
- Guardas `authGuard`, `roleGuard` (por `data.roles`), `guestGuard` y redirección de la raíz por rol.

## Estructura

```
src/
├── app/
│   ├── core/
│   │   ├── api/        servicios REST y puerto LogisticsApi (HTTP y simulado)
│   │   ├── auth/       AuthService, JWT y guardas
│   │   ├── config/     token APP_ENV
│   │   ├── http/       interceptores, ApiError y contexto HTTP
│   │   ├── models/     tipos del contrato con el backend
│   │   └── util/       utilidades (UUID)
│   ├── features/       auth, users, catalog, orders, dispatches, reception
│   ├── layout/         shell con menú por rol
│   └── shared/         validadores y helpers de estado
├── environments/
├── testing/            helpers de pruebas (JWT falso, entorno)
└── styles.scss         tokens y estilos globales
```

## Convenciones

- Código e identificadores en inglés; textos de la interfaz y documentación en español.
- Guía de estilo de Google para TypeScript: comillas simples, 2 espacios, `camelCase`, sin prefijo `I` en interfaces, exportaciones con nombre, `readonly` donde aplique.
- Componentes standalone con `inject()`, señales y `input()`/`output()`.
- GitFlow: `main`, `develop`, `feature/<nombre>`, `release/<versión>`, `hotfix/<nombre>`.
- Conventional Commits con scope en inglés, por ejemplo `feat(auth): add sign-in page`.

## Pendientes conocidos

- El `OrderResource` de `buildshield-core` 1.0.0 no expone el id de cada línea; el despacho usa `line.id` si llega y, si no, el `materialId` como `orderLineId`.
- `PlaceOrderRequest` del backend aún no tiene `requiredDate`: se envía el campo y además se anota en `notes`.

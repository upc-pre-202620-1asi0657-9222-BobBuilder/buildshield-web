# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [Sin publicar]

### Cambiado

- Despachos y recepciones alineados al contrato real de `buildshield-core` 1.1.0: estado `PREPARED`, `manifestCode`, transportista `{name, document, plate}`, manifiesto con `order`, `worksite` y `warehouse`, cotejo como objeto con `lines` y `tolerancePercent`.
- `POST /dispatches` lleva `Idempotency-Key`. Después de un rechazo de negocio (4xx), las pantallas generan una clave nueva.
- `mockSprint2` queda apagado en desarrollo; la simulación sigue disponible.

### Corregido

- El alta de almacén envía el `type` obligatorio.
- La recepción guarda las líneas en cola, de a una, para evitar el 409 `CONCURRENT_MODIFICATION`, y reintenta si lo recibe.
- Abrir una recepción existente (409 `RECEPTION_ALREADY_EXISTS`) carga la recepción existente.
- `INSUFFICIENT_STOCK` al aprobar muestra qué hacer.

## [0.1.0] - 2026-10-06

### Agregado

- T40 base del frontend: configuración por entorno (`apiBaseUrl`, tiempos y reintentos), `AuthService` con JWT de acceso y rotación del token de renovación, interceptores de autorización, `Idempotency-Key` automático, errores en español y reintentos con espera exponencial, guardas por rol y menú por rol.
- T06 registro de organización con validación de RUC y de contraseña.
- T08 inicio de sesión con redirección según el rol.
- T12 usuarios: lista, alta con rol y asignación a obra o almacén.
- T16 obras, almacenes y materiales (SKU, unidad y tolerancia de merma de 0 a 100), y pantalla de stock.
- T19 pedidos: alta por el encargado de obra (obra, almacén, fecha requerida y líneas), lista y detalle con estado, aprobación y rechazo por el almacén.
- Pantallas de almacén para crear el despacho desde un pedido aprobado, registrar transportista, pesaje de salida y salida.
- T32 manifiesto imprimible con datos del despacho, líneas, transportista, pesaje y QR.
- T37 recepción móvil para el encargado de obra: despachos en tránsito, comparación solicitado, despachado y recibido con merma y tolerancia, guardado progresivo por línea y confirmación.
- Simulación de los endpoints del Sprint 2 (`mockSprint2`) mientras el backend no los publique.
- Pruebas unitarias de `AuthService`, interceptores y la tabla de comparación de la recepción.

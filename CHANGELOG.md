# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

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

# buildshield-web

Aplicación web de BuildShield en Angular 18 + TypeScript. Consume la API `/api/v1` de buildshield-core (monolito modular).

## Requisitos

- Node.js 22 (o 20 / 18.19+)
- Google Chrome (para las pruebas unitarias)

## Comandos

| Comando                                   | Descripción                                       |
| ----------------------------------------- | ------------------------------------------------- |
| `npm start`                               | Servidor de desarrollo en http://localhost:4200   |
| `npm run build`                           | Compilación de producción en `dist/`              |
| `npm test`                                | Pruebas unitarias (Karma + Jasmine) en modo watch |
| `npm run test:ci`                         | Pruebas unitarias una vez, con Chrome headless    |
| `npm run lint`                            | ESLint (angular-eslint)                           |
| `npm run format` / `npm run format:check` | Formatear / verificar formato con Prettier        |

## Ramas

GitFlow: `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Commits con Conventional Commits.

/** Roles de BuildShield (feedback del Avance 1: solo tres). */
export type Role = 'ADMINISTRATOR' | 'WAREHOUSE_MANAGER' | 'SITE_MANAGER';

export const ROLES: readonly Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER', 'SITE_MANAGER'];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMINISTRATOR: 'Administrador',
  WAREHOUSE_MANAGER: 'Encargado de almacén',
  SITE_MANAGER: 'Encargado de obra',
};

/** Ruta de inicio de cada rol después de iniciar sesión. */
export function homeRouteFor(role: Role | null): string {
  switch (role) {
    case 'ADMINISTRATOR':
      return '/users';
    case 'WAREHOUSE_MANAGER':
      return '/dispatches';
    case 'SITE_MANAGER':
      return '/reception';
    default:
      return '/sign-in';
  }
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';

import {Role, homeRouteFor} from '../models/role';
import {AuthService} from './auth.service';

/** Exige sesión iniciada; si no, lleva al inicio de sesión recordando el destino. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/sign-in'], {queryParams: {returnUrl: state.url}});
};

/**
 * Exige que el rol del usuario esté en `data.roles` de la ruta. Si no, lo
 * envía a la pantalla de inicio de su rol.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] as Role[] | undefined) ?? [];
  if (roles.length === 0 || auth.hasAnyRole(roles)) {
    return true;
  }
  return inject(Router).parseUrl(homeRouteFor(auth.role()));
};

/** Las páginas públicas (inicio de sesión, registro) redirigen si ya hay sesión. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).parseUrl(homeRouteFor(auth.role()));
};

/** Redirige la raíz a la pantalla de inicio del rol. */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return inject(Router).parseUrl(auth.isAuthenticated() ? homeRouteFor(auth.role()) : '/sign-in');
};

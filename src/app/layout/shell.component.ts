import {Component, computed, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

import {LogisticsApi} from '../core/api/logistics-api';
import {AuthService} from '../core/auth/auth.service';
import {ROLE_LABELS, Role} from '../core/models/role';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly roles: readonly Role[];
}

const ALL: readonly Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER', 'SITE_MANAGER'];

/** Menú por rol: cada rol ve solo lo que puede usar. */
export const NAV_ITEMS: readonly NavItem[] = [
  {path: '/reception', label: 'Recepción', roles: ['SITE_MANAGER']},
  {path: '/orders', label: 'Pedidos', roles: ALL},
  {path: '/dispatches', label: 'Despachos', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/stock', label: 'Stock', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/users', label: 'Usuarios', roles: ['ADMINISTRATOR']},
  {path: '/worksites', label: 'Obras', roles: ALL},
  {path: '/warehouses', label: 'Almacenes', roles: ALL},
  {path: '/materials', label: 'Materiales', roles: ALL},
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly simulated = inject(LogisticsApi).simulated;

  protected readonly menuOpen = signal(false);
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return NAV_ITEMS.filter((item) => role !== null && item.roles.includes(role));
  });

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected signOut(): void {
    this.auth.signOut().subscribe(() => void this.router.navigate(['/sign-in']));
  }
}

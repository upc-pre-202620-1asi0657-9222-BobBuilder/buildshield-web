import {Component, HostListener, computed, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

import {LogisticsApi} from '../core/api/logistics-api';
import {AuthService} from '../core/auth/auth.service';
import {ROLE_LABELS, Role} from '../core/models/role';
import {IconComponent} from '../shared/icon.component';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  readonly roles: readonly Role[];
}

const ALL: readonly Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER', 'SITE_MANAGER'];

/** Menú por rol: cada rol ve solo lo que puede usar. */
export const NAV_ITEMS: readonly NavItem[] = [
  {path: '/reception', label: 'Recepción', icon: 'reception', roles: ['SITE_MANAGER']},
  {path: '/orders', label: 'Pedidos', icon: 'orders', roles: ALL},
  {path: '/dispatches', label: 'Despachos', icon: 'truck', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/stock', label: 'Stock', icon: 'stock', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/users', label: 'Usuarios', icon: 'users', roles: ['ADMINISTRATOR']},
  {path: '/worksites', label: 'Obras', icon: 'worksites', roles: ALL},
  {path: '/warehouses', label: 'Almacenes', icon: 'warehouses', roles: ALL},
  {path: '/materials', label: 'Materiales', icon: 'materials', roles: ALL},
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
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

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected signOut(): void {
    this.auth.signOut().subscribe(() => void this.router.navigate(['/sign-in']));
  }
}

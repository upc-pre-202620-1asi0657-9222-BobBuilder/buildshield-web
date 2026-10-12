import {Component, HostListener, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {filter, interval, merge, startWith} from 'rxjs';

import {LogisticsApi} from '../core/api/logistics-api';
import {AuthService} from '../core/auth/auth.service';
import {ROLE_LABELS, Role} from '../core/models/role';
import {SubscriptionStateService, daysLeftLabel} from '../core/subscription/subscription-state.service';
import {UNREAD_POLL_MS, UnreadNotificationsService} from '../features/notifications/unread-notifications.service';
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
  {path: '/tracking', label: 'En ruta', icon: 'route', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/discrepancies', label: 'Discrepancias', icon: 'alert', roles: ALL},
  {path: '/returns', label: 'Devoluciones', icon: 'return', roles: ALL},
  {path: '/stock', label: 'Inventario', icon: 'stock', roles: ['ADMINISTRATOR', 'WAREHOUSE_MANAGER']},
  {path: '/reports', label: 'Reportes', icon: 'report', roles: ALL},
  {path: '/users', label: 'Usuarios', icon: 'users', roles: ['ADMINISTRATOR']},
  {path: '/worksites', label: 'Obras', icon: 'worksites', roles: ALL},
  {path: '/warehouses', label: 'Almacenes', icon: 'warehouses', roles: ALL},
  {path: '/materials', label: 'Materiales', icon: 'materials', roles: ALL},
  {path: '/suscripcion', label: 'Suscripción', icon: 'card', roles: ['ADMINISTRATOR']},
];

/** Cada cuánto se vuelve a consultar la suscripción (días de prueba, solo lectura). */
export const SUBSCRIPTION_POLL_MS = 5 * 60_000;

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
  private readonly unread = inject(UnreadNotificationsService);
  private readonly subscriptionState = inject(SubscriptionStateService);
  protected readonly subscription = this.subscriptionState.subscription;
  protected readonly readOnly = this.subscriptionState.readOnly;
  protected readonly inTrial = this.subscriptionState.inTrial;
  protected readonly trialEndingSoon = this.subscriptionState.trialEndingSoon;
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMINISTRATOR');
  protected readonly daysLeft = computed(() => daysLeftLabel(this.subscription()?.daysRemaining ?? 0));
  protected readonly unreadCount = this.unread.count;
  protected readonly bellLabel = computed(() => {
    const count = this.unreadCount();
    return count === 0
      ? 'Notificaciones, ninguna sin leer'
      : `Notificaciones, ${count} sin leer`;
  });

  protected readonly menuOpen = signal(false);
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return NAV_ITEMS.filter((item) => role !== null && item.roles.includes(role));
  });

  constructor() {
    // Contador de la campana: cada 60 s y al cambiar de ruta (US43).
    merge(
      interval(UNREAD_POLL_MS).pipe(startWith(0)),
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.unread.refresh());

    // Suscripción: al entrar y cada 5 min (US06 y US10). Un 402 la marca al instante.
    interval(SUBSCRIPTION_POLL_MS)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.subscriptionState.refresh());
  }

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected signOut(): void {
    this.subscriptionState.clear();
    this.auth.signOut().subscribe(() => void this.router.navigate(['/sign-in']));
  }
}

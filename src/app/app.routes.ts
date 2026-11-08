import {Routes} from '@angular/router';

import {authGuard, guestGuard, roleGuard} from './core/auth/guards';
import {Role} from './core/models/role';

const ADMIN: Role[] = ['ADMINISTRATOR'];
const WAREHOUSE: Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER'];
const SITE: Role[] = ['SITE_MANAGER'];
const SITE_OR_ADMIN: Role[] = ['ADMINISTRATOR', 'SITE_MANAGER'];
const ALL: Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER', 'SITE_MANAGER'];

export const routes: Routes = [
  // Visitantes ven la página pública; con sesión, guestGuard lleva al panel del rol.
  {
    path: '',
    pathMatch: 'full',
    title: 'BuildShield | Trazabilidad de materiales entre almacén y obra',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/public/landing-page.component').then((m) => m.LandingPageComponent),
  },
  {
    path: 'terminos',
    title: 'Términos del servicio | BuildShield',
    loadComponent: () =>
      import('./features/public/terms-page.component').then((m) => m.TermsPageComponent),
  },
  {
    path: 'privacidad',
    title: 'Política de privacidad | BuildShield',
    loadComponent: () =>
      import('./features/public/privacy-page.component').then((m) => m.PrivacyPageComponent),
  },
  {
    path: 'sign-in',
    title: 'Iniciar sesión | BuildShield',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/sign-in-page.component').then((m) => m.SignInPageComponent),
  },
  {
    path: 'sign-up',
    title: 'Registrar organización | BuildShield',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/sign-up-page.component').then((m) => m.SignUpPageComponent),
  },
  {
    path: 'dispatches/:id/manifest',
    title: 'Manifiesto | BuildShield',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dispatches/manifest-page.component').then((m) => m.ManifestPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'users',
        title: 'Usuarios | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ADMIN},
        loadComponent: () =>
          import('./features/users/users-page.component').then((m) => m.UsersPageComponent),
      },
      {
        path: 'worksites',
        title: 'Obras | BuildShield',
        loadComponent: () =>
          import('./features/catalog/worksites-page.component').then(
            (m) => m.WorksitesPageComponent,
          ),
      },
      {
        path: 'warehouses',
        title: 'Almacenes | BuildShield',
        loadComponent: () =>
          import('./features/catalog/warehouses-page.component').then(
            (m) => m.WarehousesPageComponent,
          ),
      },
      {
        path: 'materials',
        title: 'Materiales | BuildShield',
        loadComponent: () =>
          import('./features/catalog/materials-page.component').then(
            (m) => m.MaterialsPageComponent,
          ),
      },
      {
        path: 'stock',
        title: 'Inventario | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/catalog/stock-page.component').then((m) => m.StockPageComponent),
      },
      {
        path: 'stock/movements',
        title: 'Movimientos de inventario | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/inventory/movements-page.component').then((m) => m.MovementsPageComponent),
      },
      {
        path: 'stock/counts',
        title: 'Conteos de inventario | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/inventory/count-list-page.component').then((m) => m.CountListPageComponent),
      },
      {
        path: 'stock/counts/:id',
        title: 'Conteo | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/inventory/count-detail-page.component').then((m) => m.CountDetailPageComponent),
      },
      {
        path: 'returns',
        title: 'Devoluciones | BuildShield',
        loadComponent: () =>
          import('./features/returns/return-list-page.component').then((m) => m.ReturnListPageComponent),
      },
      {
        path: 'returns/new',
        title: 'Saldos de la obra | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE_OR_ADMIN},
        loadComponent: () =>
          import('./features/returns/return-create-page.component').then((m) => m.ReturnCreatePageComponent),
      },
      {
        path: 'returns/:id',
        title: 'Devolución | BuildShield',
        loadComponent: () =>
          import('./features/returns/return-detail-page.component').then((m) => m.ReturnDetailPageComponent),
      },
      {
        path: 'reports',
        title: 'Conciliación | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ALL},
        loadComponent: () =>
          import('./features/reports/reconciliation-report-page.component').then(
            (m) => m.ReconciliationReportPageComponent,
          ),
      },
      {
        path: 'suscripcion',
        title: 'Suscripción | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ADMIN},
        loadComponent: () =>
          import('./features/subscription/subscription-page.component').then((m) => m.SubscriptionPageComponent),
      },
      {
        path: 'suscripcion/planes',
        title: 'Planes | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ADMIN},
        loadComponent: () =>
          import('./features/subscription/plans-page.component').then((m) => m.PlansPageComponent),
      },
      {
        // Destino de PAYMENTS_SIMULATED_CHECKOUT_URL de subscription-service (modo demostración).
        path: 'suscripcion/pago-simulado',
        title: 'Pago simulado | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ADMIN},
        loadComponent: () =>
          import('./features/subscription/simulated-payment-page.component').then(
            (m) => m.SimulatedPaymentPageComponent,
          ),
      },
      {
        path: 'orders',
        title: 'Pedidos | BuildShield',
        loadComponent: () =>
          import('./features/orders/order-list-page.component').then(
            (m) => m.OrderListPageComponent,
          ),
      },
      {
        path: 'orders/new',
        title: 'Nuevo pedido | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/orders/order-create-page.component').then(
            (m) => m.OrderCreatePageComponent,
          ),
      },
      {
        path: 'orders/:id/edit',
        title: 'Editar pedido | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/orders/order-create-page.component').then(
            (m) => m.OrderCreatePageComponent,
          ),
      },
      {
        path: 'orders/:id',
        title: 'Detalle del pedido | BuildShield',
        loadComponent: () =>
          import('./features/orders/order-detail-page.component').then(
            (m) => m.OrderDetailPageComponent,
          ),
      },
      {
        path: 'dispatches',
        title: 'Despachos | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/dispatches/dispatch-list-page.component').then(
            (m) => m.DispatchListPageComponent,
          ),
      },
      {
        path: 'dispatches/new',
        title: 'Nuevo despacho | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/dispatches/dispatch-create-page.component').then(
            (m) => m.DispatchCreatePageComponent,
          ),
      },
      {
        path: 'dispatches/:id/custody',
        title: 'Historial de custodia | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ALL},
        loadComponent: () =>
          import('./features/dispatches/custody-page.component').then((m) => m.CustodyPageComponent),
      },
      {
        path: 'tracking',
        title: 'En ruta | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/tracking/tracking-page.component').then((m) => m.TrackingPageComponent),
      },
      {
        path: 'dispatches/:id',
        title: 'Despacho | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/dispatches/dispatch-detail-page.component').then(
            (m) => m.DispatchDetailPageComponent,
          ),
      },
      {
        path: 'reception',
        title: 'Recepción | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/reception/reception-list-page.component').then(
            (m) => m.ReceptionListPageComponent,
          ),
      },
      {
        path: 'reception/scan',
        title: 'Abrir por código | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/reception/scan-page.component').then((m) => m.ScanPageComponent),
      },
      {
        path: 'reception/:dispatchId',
        title: 'Recibir despacho | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/reception/reception-page.component').then(
            (m) => m.ReceptionPageComponent,
          ),
      },
      {
        path: 'discrepancies',
        title: 'Discrepancias | BuildShield',
        loadComponent: () =>
          import('./features/discrepancies/discrepancy-list-page.component').then(
            (m) => m.DiscrepancyListPageComponent,
          ),
      },
      {
        path: 'discrepancies/:id',
        title: 'Discrepancia | BuildShield',
        loadComponent: () =>
          import('./features/discrepancies/discrepancy-detail-page.component').then(
            (m) => m.DiscrepancyDetailPageComponent,
          ),
      },
      {
        path: 'notifications/recipients',
        title: 'Destinatarios de avisos | BuildShield',
        canActivate: [roleGuard],
        data: {roles: ADMIN},
        loadComponent: () =>
          import('./features/notifications/recipient-settings-page.component').then(
            (m) => m.RecipientSettingsPageComponent,
          ),
      },
      {
        path: 'notifications',
        title: 'Notificaciones | BuildShield',
        loadComponent: () =>
          import('./features/notifications/notifications-page.component').then(
            (m) => m.NotificationsPageComponent,
          ),
      },
    ],
  },
  {path: '**', redirectTo: ''},
];

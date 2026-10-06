import {Routes} from '@angular/router';

import {authGuard, guestGuard, homeRedirectGuard, roleGuard} from './core/auth/guards';
import {Role} from './core/models/role';

const ADMIN: Role[] = ['ADMINISTRATOR'];
const WAREHOUSE: Role[] = ['ADMINISTRATOR', 'WAREHOUSE_MANAGER'];
const SITE: Role[] = ['SITE_MANAGER'];

export const routes: Routes = [
  {path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: []},
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
        title: 'Stock | BuildShield',
        canActivate: [roleGuard],
        data: {roles: WAREHOUSE},
        loadComponent: () =>
          import('./features/catalog/stock-page.component').then((m) => m.StockPageComponent),
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
        path: 'reception/:dispatchId',
        title: 'Recibir despacho | BuildShield',
        canActivate: [roleGuard],
        data: {roles: SITE},
        loadComponent: () =>
          import('./features/reception/reception-page.component').then(
            (m) => m.ReceptionPageComponent,
          ),
      },
    ],
  },
  {path: '**', redirectTo: ''},
];

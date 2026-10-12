import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';

/** Pestañas de la sección Inventario (US40 y US41). */
@Component({
  selector: 'app-inventory-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Secciones del inventario">
      <ul class="tabs">
        <li>
          <a routerLink="/stock" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page">
            Existencias
          </a>
        </li>
        <li>
          <a routerLink="/stock/movements" routerLinkActive="active" ariaCurrentWhenActive="page">Movimientos</a>
        </li>
        <li>
          <a routerLink="/stock/counts" routerLinkActive="active" ariaCurrentWhenActive="page">Conteos</a>
        </li>
      </ul>
    </nav>
  `,
})
export class InventoryTabsComponent {}

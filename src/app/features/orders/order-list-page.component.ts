import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';

import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Order} from '../../core/models/order';
import {nameIndex, orderStatusLabel, statusBadgeClass} from '../../shared/status';

/** T19: lista de pedidos con su estado. */
@Component({
  selector: 'app-order-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Pedidos</h1>
        @if (isSiteManager()) {
          <a class="btn btn-primary" routerLink="/orders/new">Nuevo pedido</a>
        }
      </div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>Fecha</th><th>Obra</th><th>Almacén</th><th>Materiales</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            @for (order of orders(); track order.id) {
              <tr>
                <td data-label="Fecha">{{ order.placedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td data-label="Obra">{{ worksiteNames().get(order.worksiteId) ?? '-' }}</td>
                <td data-label="Almacén">{{ warehouseNames().get(order.warehouseId) ?? '-' }}</td>
                <td data-label="Materiales">{{ order.lines.length }}</td>
                <td data-label="Estado">
                  <span class="badge" [class]="'badge ' + badge(order.status)">{{ label(order) }}</span>
                </td>
                <td data-label="">
                  <a class="btn" [routerLink]="['/orders', order.id]">Ver</a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted">{{ loading() ? 'Cargando…' : 'No hay pedidos.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class OrderListPageComponent implements OnInit {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly auth = inject(AuthService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly worksiteNames = signal(new Map<string, string>());
  protected readonly warehouseNames = signal(new Map<string, string>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly isSiteManager = computed(() => this.auth.role() === 'SITE_MANAGER');

  protected readonly label = orderStatusLabel;
  protected readonly badge = statusBadgeClass;

  ngOnInit(): void {
    forkJoin({
      orders: this.ordersApi.list(),
      worksites: this.orgApi.listWorksites(),
      warehouses: this.orgApi.listWarehouses(),
    }).subscribe({
      next: ({orders, worksites, warehouses}) => {
        this.orders.set([...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt)));
        this.worksiteNames.set(nameIndex(worksites));
        this.warehouseNames.set(nameIndex(warehouses));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

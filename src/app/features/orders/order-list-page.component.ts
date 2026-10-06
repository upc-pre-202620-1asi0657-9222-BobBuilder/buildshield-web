import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';

import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Order} from '../../core/models/order';
import {IconComponent} from '../../shared/icon.component';
import {nameIndex, orderStatusLabel, statusBadgeClass} from '../../shared/status';

/** T19: lista de pedidos con su estado. */
@Component({
  selector: 'app-order-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Pedidos</h1>
        @if (isSiteManager()) {
          <div class="actions">
            <a class="btn btn-primary" routerLink="/orders/new">
              <app-icon name="plus" />
              Nuevo pedido
            </a>
          </div>
        }
      </div>
      <p class="lead">
        {{
          isSiteManager()
            ? 'Materiales que pediste para tus obras y en qué va cada pedido.'
            : 'Materiales que piden las obras. Abre un pedido para aprobarlo o despacharlo.'
        }}
      </p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p class="loading">Cargando pedidos…</p>
      } @else if (orders().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Obra</th>
                  <th>Almacén</th>
                  <th class="num">Materiales</th>
                  <th>Estado</th>
                  <th><span class="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (order of orders(); track order.id) {
                  <tr>
                    <td data-label="Fecha">{{ order.placedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td data-label="Obra">{{ worksiteNames().get(order.worksiteId) ?? '-' }}</td>
                    <td data-label="Almacén">{{ warehouseNames().get(order.warehouseId) ?? '-' }}</td>
                    <td data-label="Materiales" class="num">{{ order.lines.length }}</td>
                    <td data-label="Estado">
                      <span [class]="'badge ' + badge(order.status)">{{ label(order) }}</span>
                    </td>
                    <td data-label="" class="row-actions">
                      <a class="btn" [routerLink]="['/orders', order.id]">Ver pedido</a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>Aún no hay pedidos</strong>
          @if (isSiteManager()) {
            <p>Pide los materiales que necesitas en obra y el almacén los preparará.</p>
            <a class="btn btn-primary" routerLink="/orders/new">
              <app-icon name="plus" />
              Hacer el primer pedido
            </a>
          } @else {
            <p>Cuando un encargado de obra pida materiales, el pedido aparecerá aquí.</p>
          }
        </div>
      }
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

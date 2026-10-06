import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Dispatch, dispatchStatusLabel} from '../../core/models/logistics';
import {DISPATCHABLE_ORDER_STATUSES, Order} from '../../core/models/order';
import {Worksite} from '../../core/models/organization';
import {nameIndex, statusBadgeClass} from '../../shared/status';

/** Bandeja del almacén: pedidos por atender y despachos en curso. */
@Component({
  selector: 'app-dispatch-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="page">
      <div class="page-header"><h1>Despachos</h1></div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <div class="card">
        <h2>Pedidos por despachar</h2>
        <table class="table">
          <thead><tr><th>Pedido</th><th>Obra</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            @for (o of pendingOrders(); track o.id) {
              <tr>
                <td data-label="Pedido"><a [routerLink]="['/orders', o.id]">{{ o.id.slice(0, 8) }}</a></td>
                <td data-label="Obra">{{ worksiteNames().get(o.worksiteId) ?? '-' }}</td>
                <td data-label="Fecha">{{ o.placedAt | date: 'dd/MM/yyyy' }}</td>
                <td data-label="">
                  <a class="btn btn-primary" routerLink="/dispatches/new" [queryParams]="{orderId: o.id}">
                    Crear despacho
                  </a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">{{ loading() ? 'Cargando…' : 'No hay pedidos aprobados pendientes.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Despachos</h2>
        <table class="table">
          <thead><tr><th>Código</th><th>Obra</th><th>Creado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (d of dispatches(); track d.id) {
              <tr>
                <td data-label="Código">{{ d.code ?? d.id.slice(0, 8) }}</td>
                <td data-label="Obra">{{ (d.worksiteId && worksiteNames().get(d.worksiteId)) || '-' }}</td>
                <td data-label="Creado">{{ d.createdAt ? (d.createdAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</td>
                <td data-label="Estado"><span [class]="'badge ' + badge(d.status)">{{ label(d) }}</span></td>
                <td data-label=""><a class="btn" [routerLink]="['/dispatches', d.id]">Abrir</a></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">{{ loading() ? 'Cargando…' : 'Aún no hay despachos.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class DispatchListPageComponent implements OnInit {
  private readonly logistics = inject(LogisticsApi);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly orgApi = inject(OrganizationApiService);

  protected readonly pendingOrders = signal<Order[]>([]);
  protected readonly dispatches = signal<Dispatch[]>([]);
  protected readonly worksiteNames = signal(new Map<string, string>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly label = dispatchStatusLabel;
  protected readonly badge = statusBadgeClass;

  ngOnInit(): void {
    const errors: string[] = [];
    const remember = (err: unknown) => errors.push(toApiError(err).message);
    forkJoin({
      orders: this.ordersApi.list().pipe(catchError((e: unknown) => (remember(e), of<Order[]>([])))),
      dispatches: this.logistics
        .listDispatches()
        .pipe(catchError((e: unknown) => (remember(e), of<Dispatch[]>([])))),
      worksites: this.orgApi
        .listWorksites()
        .pipe(catchError((e: unknown) => (remember(e), of<Worksite[]>([])))),
    }).subscribe(({orders, dispatches, worksites}) => {
      this.pendingOrders.set(
        orders.filter(
          (o) => DISPATCHABLE_ORDER_STATUSES.includes(o.status) && o.lines.some((l) => l.pending > 0),
        ),
      );
      this.dispatches.set(dispatches);
      this.worksiteNames.set(nameIndex(worksites));
      this.loading.set(false);
      this.error.set(errors.length ? [...new Set(errors)].join(' ') : null);
    });
  }
}

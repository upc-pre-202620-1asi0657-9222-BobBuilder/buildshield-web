import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Dispatch, dispatchStatusLabel} from '../../core/models/logistics';
import {DISPATCHABLE_ORDER_STATUSES, Order} from '../../core/models/order';
import {generateUuid} from '../../core/util/uuid';
import {nameIndex, orderStatusLabel, statusBadgeClass} from '../../shared/status';

/** T19: detalle del pedido con estado; el almacén lo aprueba, rechaza o despacha. */
@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './order-detail-page.component.html',
})
export class OrderDetailPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly ordersApi = inject(OrdersApiService);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly logistics = inject(LogisticsApi);
  private readonly auth = inject(AuthService);

  protected readonly order = signal<Order | null>(null);
  protected readonly dispatches = signal<Dispatch[]>([]);
  protected readonly worksiteName = signal('');
  protected readonly warehouseName = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected rejectReason = '';
  protected readonly showReject = signal(false);

  protected readonly label = orderStatusLabel;
  protected readonly badge = statusBadgeClass;
  protected readonly dispatchLabel = dispatchStatusLabel;

  protected readonly canDecide = computed(
    () =>
      this.auth.hasAnyRole(['ADMINISTRATOR', 'WAREHOUSE_MANAGER']) &&
      this.order()?.status === 'REGISTERED',
  );
  protected readonly canDispatch = computed(() => {
    const order = this.order();
    return (
      order !== null &&
      this.auth.hasAnyRole(['ADMINISTRATOR', 'WAREHOUSE_MANAGER']) &&
      DISPATCHABLE_ORDER_STATUSES.includes(order.status) &&
      order.lines.some((l) => l.pending > 0)
    );
  });

  /** Claves reusadas si el usuario repite la misma decisión tras un error. */
  private approveKey = generateUuid();
  private rejectKey = generateUuid();

  ngOnInit(): void {
    this.load();
  }

  protected approve(): void {
    this.decide(this.ordersApi.approve(this.id(), this.approveKey));
  }

  protected reject(): void {
    const reason = this.rejectReason.trim();
    if (!reason) {
      this.error.set('Escribe el motivo del rechazo.');
      return;
    }
    this.decide(this.ordersApi.reject(this.id(), reason, this.rejectKey));
  }

  private decide(request: ReturnType<OrdersApiService['approve']>): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (order) => {
        this.busy.set(false);
        this.showReject.set(false);
        this.order.set(order);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private load(): void {
    forkJoin({
      order: this.ordersApi.get(this.id()),
      worksites: this.orgApi.listWorksites(),
      warehouses: this.orgApi.listWarehouses(),
      dispatches: this.logistics
        .listDispatches({orderId: this.id()})
        .pipe(catchError(() => of([] as Dispatch[]))),
    }).subscribe({
      next: ({order, worksites, warehouses, dispatches}) => {
        this.order.set(order);
        this.worksiteName.set(nameIndex(worksites).get(order.worksiteId) ?? '-');
        this.warehouseName.set(nameIndex(warehouses).get(order.warehouseId) ?? '-');
        this.dispatches.set(dispatches);
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}

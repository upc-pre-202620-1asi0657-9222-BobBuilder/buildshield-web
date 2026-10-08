import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, DestroyRef, OnInit, computed, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Subscription, catchError, filter, forkJoin, of, switchMap, take, timer} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {Dispatch, dispatchStatusLabel} from '../../core/models/logistics';
import {APPROVAL_PENDING, DISPATCHABLE_ORDER_STATUSES, Order} from '../../core/models/order';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';
import {nameIndex, orderStatusLabel, statusBadgeClass} from '../../shared/status';

/** Consultas del pedido mientras la saga de reserva de stock está en curso. */
export const APPROVAL_POLL_MS = 1500;
export const APPROVAL_POLL_ATTEMPTS = 8;

/** T19: detalle del pedido con estado; el almacén lo aprueba, rechaza o despacha. */
@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule, IconComponent],
  styles: `
    .reject {
      margin-top: 16px;
    }
  `,
  templateUrl: './order-detail-page.component.html',
})
export class OrderDetailPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly ordersApi = inject(OrdersApiService);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly logistics = inject(LogisticsApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private poll: Subscription | null = null;

  protected readonly order = signal<Order | null>(null);
  protected readonly dispatches = signal<Dispatch[]>([]);
  protected readonly worksiteName = signal('');
  protected readonly warehouseName = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected rejectReason = '';
  protected readonly showReject = signal(false);
  /** Mensaje del resultado de la aprobación (reserva de stock asíncrona). */
  protected readonly approvalNotice = signal<string | null>(null);
  protected readonly approving = computed(() => this.order()?.status === APPROVAL_PENDING);

  protected readonly label = orderStatusLabel;
  protected readonly badge = statusBadgeClass;
  protected readonly dispatchLabel = dispatchStatusLabel;

  protected readonly canDecide = computed(
    () =>
      this.auth.hasAnyRole(['ADMINISTRATOR', 'WAREHOUSE_MANAGER']) &&
      this.order()?.status === 'REGISTERED',
  );
  /** Solo el almacén y el administrador abren el detalle de un despacho. */
  protected readonly isWarehouse = computed(() =>
    this.auth.hasAnyRole(['ADMINISTRATOR', 'WAREHOUSE_MANAGER']),
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
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
    this.load();
  }

  protected approve(): void {
    this.approvalNotice.set(null);
    this.decide(this.ordersApi.approve(this.id(), this.approveKey), true);
  }

  protected reject(): void {
    const reason = this.rejectReason.trim();
    if (!reason) {
      this.error.set('Escribe el motivo del rechazo.');
      return;
    }
    this.decide(this.ordersApi.reject(this.id(), reason, this.rejectKey));
  }

  private decide(request: ReturnType<OrdersApiService['approve']>, approving = false): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (order) => {
        this.busy.set(false);
        this.showReject.set(false);
        this.order.set(order);
        if (approving) {
          this.approveKey = generateUuid();
          this.followApproval(order);
        }
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.approveKey = generateUuid();
          this.rejectKey = generateUuid();
        }
      },
    });
  }

  /**
   * Con microservicios, aprobar deja el pedido en «Aprobando» mientras
   * inventario reserva el stock. Se consulta unas veces hasta que cambie.
   */
  private followApproval(order: Order): void {
    this.poll?.unsubscribe();
    if (order.status !== APPROVAL_PENDING) {
      this.reportApproval(order);
      return;
    }
    this.poll = timer(APPROVAL_POLL_MS, APPROVAL_POLL_MS)
      .pipe(
        take(APPROVAL_POLL_ATTEMPTS),
        switchMap(() => this.ordersApi.get(this.id()).pipe(catchError(() => of(null)))),
        filter((o): o is Order => o !== null),
      )
      .subscribe({
        next: (current) => {
          this.order.set(current);
          if (current.status !== APPROVAL_PENDING) {
            this.poll?.unsubscribe();
            this.reportApproval(current);
          }
        },
        complete: () => {
          if (this.order()?.status === APPROVAL_PENDING) {
            this.approvalNotice.set('La reserva de stock sigue en curso. Actualiza la página en unos segundos.');
          }
        },
      });
  }

  private reportApproval(order: Order): void {
    // Si vuelve a Registrado, el motivo se muestra en la ficha del pedido.
    if (DISPATCHABLE_ORDER_STATUSES.includes(order.status)) {
      this.approvalNotice.set('Pedido aprobado y stock reservado.');
    }
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
        if (order.status === APPROVAL_PENDING) {
          this.followApproval(order);
        }
        this.worksiteName.set(nameIndex(worksites).get(order.worksiteId) ?? '-');
        this.warehouseName.set(nameIndex(warehouses).get(order.warehouseId) ?? '-');
        this.dispatches.set(dispatches);
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}

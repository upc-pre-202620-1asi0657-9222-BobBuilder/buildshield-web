import {DecimalPipe} from '@angular/common';
import {Component, OnInit, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrdersApiService} from '../../core/api/orders-api.service';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {Order, OrderLine, orderLineKey} from '../../core/models/order';
import {generateUuid} from '../../core/util/uuid';

interface DraftLine {
  readonly line: OrderLine;
  quantity: number;
}

/** El almacén arma un despacho desde un pedido aprobado (cantidades por línea). */
@Component({
  selector: 'app-dispatch-create-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Nuevo despacho</h1>
        <a class="btn" routerLink="/dispatches">Volver</a>
      </div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (order(); as o) {
        <div class="card">
          <p class="muted">Pedido {{ o.id.slice(0, 8) }}. Por defecto se despacha todo lo pendiente.</p>
          <table class="table">
            <thead>
              <tr><th>SKU</th><th class="num">Pendiente</th><th>Despachar</th></tr>
            </thead>
            <tbody>
              @for (d of drafts(); track d.line.materialId) {
                <tr>
                  <td data-label="SKU">{{ d.line.sku }} <span class="muted">{{ d.line.unit }}</span></td>
                  <td data-label="Pendiente" class="num">{{ d.line.pending | number: '1.0-3' }}</td>
                  <td data-label="Despachar">
                    <div class="field">
                      <input
                        type="number"
                        inputmode="decimal"
                        min="0"
                        [max]="d.line.pending"
                        step="0.001"
                        [(ngModel)]="d.quantity"
                        [attr.aria-label]="'Cantidad a despachar de ' + d.line.sku"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" (click)="create()" [disabled]="saving()">
              {{ saving() ? 'Creando…' : 'Crear despacho' }}
            </button>
          </div>
        </div>
      } @else if (!error()) {
        <p class="muted">Cargando…</p>
      }
    </section>
  `,
})
export class DispatchCreatePageComponent implements OnInit {
  /** Query param ?orderId. */
  readonly orderId = input<string>('');

  private readonly ordersApi = inject(OrdersApiService);
  private readonly logistics = inject(LogisticsApi);
  private readonly router = inject(Router);

  protected readonly order = signal<Order | null>(null);
  protected readonly drafts = signal<DraftLine[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** POST /dispatches exige Idempotency-Key; se reusa si el usuario reintenta lo mismo. */
  private idempotencyKey = generateUuid();
  private lastPayload = '';

  ngOnInit(): void {
    if (!this.orderId()) {
      this.error.set('Elige un pedido aprobado desde la bandeja de despachos.');
      return;
    }
    this.ordersApi.get(this.orderId()).subscribe({
      next: (order) => {
        this.order.set(order);
        this.drafts.set(
          order.lines.filter((l) => l.pending > 0).map((line) => ({line, quantity: line.pending})),
        );
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected create(): void {
    const order = this.order();
    if (!order) {
      return;
    }
    const lines = this.drafts()
      .filter((d) => Number(d.quantity) > 0)
      .map((d) => ({orderLineId: orderLineKey(d.line), quantity: Number(d.quantity)}));
    const exceeded = this.drafts().find((d) => Number(d.quantity) > d.line.pending);
    if (exceeded) {
      this.error.set(`La cantidad de ${exceeded.line.sku} supera lo pendiente.`);
      return;
    }
    if (lines.length === 0) {
      this.error.set('Indica al menos una cantidad mayor que cero.');
      return;
    }
    const request = {orderId: order.id, lines};
    const payload = JSON.stringify(request);
    if (payload !== this.lastPayload) {
      this.idempotencyKey = generateUuid();
      this.lastPayload = payload;
    }
    this.saving.set(true);
    this.error.set(null);
    this.logistics.createDispatch(request, this.idempotencyKey).subscribe({
      next: (dispatch) => void this.router.navigate(['/dispatches', dispatch.id]),
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.saving.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.lastPayload = '';
        }
      },
    });
  }
}

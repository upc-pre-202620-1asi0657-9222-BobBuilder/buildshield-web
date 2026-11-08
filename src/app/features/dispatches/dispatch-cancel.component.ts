import {Component, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {LogisticsApi} from '../../core/api/logistics-api';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {Dispatch} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';

export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 300;

/**
 * US25: anular un despacho que aún no salió. Pide el motivo y una segunda
 * confirmación porque devuelve lo despachado a lo pendiente del pedido.
 */
@Component({
  selector: 'app-dispatch-cancel',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="card cancel-card">
      <h2>Anular despacho</h2>
      @if (!open()) {
        <p class="muted">
          Si el camión no va a salir, anula el despacho. Lo despachado vuelve a quedar pendiente en el pedido.
        </p>
        <button class="btn btn-danger open-cancel" type="button" (click)="open.set(true)">
          <app-icon name="x-circle" />
          Anular despacho
        </button>
      } @else {
        <div class="field">
          <label for="cancelReason">Motivo de la anulación</label>
          <textarea
            id="cancelReason"
            rows="2"
            [(ngModel)]="reason"
            [maxlength]="max"
            aria-describedby="cancelReasonHint"
          ></textarea>
          <span class="hint" id="cancelReasonHint">
            De {{ min }} a {{ max }} caracteres. Por ejemplo, «La obra pidió postergar la entrega».
          </span>
        </div>
        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
        <div class="form-actions">
          <button class="btn btn-danger confirm-cancel" type="button" (click)="confirm()" [disabled]="busy()">
            {{ busy() ? 'Anulando…' : 'Confirmar anulación' }}
          </button>
          <button class="btn btn-ghost" type="button" (click)="close()" [disabled]="busy()">Volver</button>
        </div>
      }
    </div>
  `,
  styles: `
    .cancel-card {
      border-left: 6px solid var(--bs-merma);
    }
  `,
})
export class DispatchCancelComponent {
  readonly dispatchId = input.required<string>();
  readonly cancelled = output<Dispatch>();

  private readonly logistics = inject(LogisticsApi);

  protected readonly min = CANCEL_REASON_MIN;
  protected readonly max = CANCEL_REASON_MAX;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected reason = '';

  /** Se reusa si el usuario vuelve a confirmar tras una falla de red. */
  private key = generateUuid();

  protected close(): void {
    this.open.set(false);
    this.error.set(null);
  }

  protected confirm(): void {
    const reason = this.reason.trim();
    if (reason.length < CANCEL_REASON_MIN || reason.length > CANCEL_REASON_MAX) {
      this.error.set(`Escribe el motivo, de ${CANCEL_REASON_MIN} a ${CANCEL_REASON_MAX} caracteres.`);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.logistics.cancelDispatch(this.dispatchId(), reason, this.key).subscribe({
      next: (dispatch) => {
        this.busy.set(false);
        this.open.set(false);
        this.cancelled.emit(dispatch);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.key = generateUuid();
        }
      },
    });
  }
}

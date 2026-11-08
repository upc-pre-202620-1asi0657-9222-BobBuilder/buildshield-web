import {DecimalPipe} from '@angular/common';
import {Component, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {LogisticsApi} from '../../core/api/logistics-api';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {ArrivalWeighing} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';

/**
 * US29: pesaje de llegada en obra y comparación con el pesaje de salida frente
 * a la menor tolerancia de los materiales del despacho. Se registra una vez.
 */
@Component({
  selector: 'app-arrival-weighing',
  standalone: true,
  imports: [FormsModule, DecimalPipe, IconComponent],
  template: `
    <div class="card step" [class.step-done]="!!weighing()">
      <h2>
        <app-icon name="scale" />
        Pesaje de llegada
        @if (weighing()) {
          <span class="badge badge-ok">Registrado</span>
        }
      </h2>

      @if (weighing(); as w) {
        <dl class="kv result">
          <div>
            <dt>Neto de llegada</dt>
            <dd>{{ w.netKg | number: '1.0-3' }} kg</dd>
          </div>
          <div>
            <dt>Neto de salida</dt>
            <dd>{{ w.departureNetKg === null ? 'Sin pesaje de salida' : (w.departureNetKg | number: '1.0-3') + ' kg' }}</dd>
          </div>
          @if (w.differenceKg !== null) {
            <div>
              <dt>Diferencia</dt>
              <dd>{{ w.differenceKg | number: '1.0-3' }} kg ({{ w.differencePercent | number: '1.0-2' }} %)</dd>
            </div>
          }
          <div>
            <dt>Tolerancia</dt>
            <dd>{{ w.tolerancePercent | number: '1.0-2' }} %</dd>
          </div>
        </dl>
        @if (w.withinTolerance === true) {
          <p class="badge badge-ok verdict">Dentro de tolerancia</p>
        } @else if (w.withinTolerance === false) {
          <p class="badge badge-bad verdict">Fuera de tolerancia: revisa material por material</p>
        } @else {
          <p class="muted verdict">Sin pesaje de salida no se puede comparar el peso.</p>
        }
      } @else if (!locked()) {
        <p class="muted">Opcional. Si la obra tiene balanza, registra el peso del camión al llegar.</p>
        <form (ngSubmit)="save()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="arrivalGross">Peso bruto (kg)</label>
              <input id="arrivalGross" name="grossKg" type="number" inputmode="decimal" min="0" step="0.001" [(ngModel)]="grossKg" />
            </div>
            <div class="field">
              <label for="arrivalTare">Tara (kg)</label>
              <input id="arrivalTare" name="tareKg" type="number" inputmode="decimal" min="0" step="0.001" [(ngModel)]="tareKg" />
            </div>
            <div class="field full">
              <label for="arrivalTicket">Enlace a la foto del ticket de balanza</label>
              <input id="arrivalTicket" name="ticketPhotoUrl" type="url" [(ngModel)]="ticketPhotoUrl" />
            </div>
          </div>
          <p class="net" aria-live="polite">
            <span class="muted">Peso neto</span>
            <strong>{{ netKg() | number: '1.0-3' }} kg</strong>
          </p>
          @if (error()) {
            <p class="alert alert-error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <button class="btn" type="submit" [disabled]="busy()">
              {{ busy() ? 'Registrando…' : 'Registrar pesaje de llegada' }}
            </button>
          </div>
        </form>
      } @else {
        <p class="muted">No se registró pesaje de llegada.</p>
      }
    </div>
  `,
  styles: `
    h2 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .verdict {
      margin: 0;
    }
  `,
})
export class ArrivalWeighingComponent {
  readonly receptionId = input.required<string>();
  readonly weighing = input<ArrivalWeighing | null | undefined>(null);
  readonly locked = input(false);
  readonly recorded = output<ArrivalWeighing>();

  private readonly logistics = inject(LogisticsApi);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected grossKg: number | null = null;
  protected tareKg: number | null = null;
  protected ticketPhotoUrl = '';

  private key = generateUuid();

  protected netKg(): number {
    return Math.max(0, Number(this.grossKg ?? 0) - Number(this.tareKg ?? 0));
  }

  protected save(): void {
    const gross = Number(this.grossKg);
    const tare = Number(this.tareKg ?? 0);
    if (!(gross > 0) || tare < 0 || gross <= tare) {
      this.error.set('El peso bruto debe ser mayor que la tara.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.logistics
      .registerArrivalWeighing(
        this.receptionId(),
        {grossKg: gross, tareKg: tare, ticketPhotoUrl: this.ticketPhotoUrl.trim() || null},
        this.key,
      )
      .subscribe({
        next: (weighing) => {
          this.busy.set(false);
          this.recorded.emit(weighing);
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

import {Component, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {LogisticsApi} from '../../core/api/logistics-api';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {DISCREPANCY_TYPES, DISCREPANCY_TYPE_LABELS, Discrepancy, DiscrepancyType} from '../../core/models/discrepancy';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';

export interface ReportableMaterial {
  materialId: string;
  sku: string;
  materialName?: string;
}

/**
 * US36: registrar una diferencia que la comparación no detecta sola (por
 * ejemplo, material dañado dentro de la tolerancia). Al crearla se abre su
 * detalle para subir las fotos.
 */
@Component({
  selector: 'app-report-discrepancy',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="card">
      <h2>Reportar otra diferencia</h2>
      @if (!open()) {
        <p class="muted">¿Llegó material dañado o equivocado? Regístralo y luego sube las fotos como evidencia.</p>
        <button class="btn open-report" type="button" (click)="open.set(true)">
          <app-icon name="alert" />
          Reportar diferencia
        </button>
      } @else {
        <form (ngSubmit)="save()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="discMaterial">Material</label>
              <select id="discMaterial" name="materialId" [(ngModel)]="materialId">
                @for (m of materials(); track m.materialId) {
                  <option [value]="m.materialId">{{ m.sku }} {{ m.materialName ?? '' }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="discType">Tipo</label>
              <select id="discType" name="type" [(ngModel)]="type">
                @for (t of types; track t) {
                  <option [value]="t">{{ labels[t] }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="discQty">Cantidad afectada</label>
              <input id="discQty" name="quantity" type="number" inputmode="decimal" min="0" step="0.001" [(ngModel)]="quantity" />
            </div>
            <div class="field full">
              <label for="discObservation">Observación</label>
              <textarea id="discObservation" name="observation" rows="2" maxlength="500" [(ngModel)]="observation"></textarea>
            </div>
          </div>
          @if (error()) {
            <p class="alert alert-error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="busy()">
              {{ busy() ? 'Registrando…' : 'Registrar diferencia' }}
            </button>
            <button class="btn btn-ghost" type="button" (click)="open.set(false)" [disabled]="busy()">Cancelar</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class ReportDiscrepancyComponent {
  readonly receptionId = input.required<string>();
  readonly materials = input<ReportableMaterial[]>([]);
  readonly created = output<Discrepancy>();

  private readonly logistics = inject(LogisticsApi);

  protected readonly types = DISCREPANCY_TYPES;
  protected readonly labels = DISCREPANCY_TYPE_LABELS;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected materialId = '';
  protected type: DiscrepancyType = 'DAMAGE';
  protected quantity: number | null = null;
  protected observation = '';

  private key = generateUuid();

  protected save(): void {
    const materialId = this.materialId || this.materials()[0]?.materialId || '';
    const quantity = Number(this.quantity);
    const observation = this.observation.trim();
    if (!materialId || !(quantity > 0) || observation.length < 3) {
      this.error.set('Elige el material, indica la cantidad afectada y describe lo que pasó.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.logistics
      .createDiscrepancy({receptionId: this.receptionId(), materialId, type: this.type, quantity, observation}, this.key)
      .subscribe({
        next: (discrepancy) => {
          this.busy.set(false);
          this.open.set(false);
          this.key = generateUuid();
          this.created.emit(discrepancy);
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

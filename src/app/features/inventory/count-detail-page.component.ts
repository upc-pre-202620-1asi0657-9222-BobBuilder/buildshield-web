import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Observable, switchMap} from 'rxjs';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {toApiError} from '../../core/http/api-error';
import {COUNT_STATUS_LABELS, StockCount, StockCountLine} from '../../core/models/inventory';
import {IconComponent} from '../../shared/icon.component';
import {countBadge} from './count-list-page.component';

/** Lo que el ajuste hace con el stock (US41 AC02): faltante disponible insuficiente da 409. */
const ADJUST_INSUFFICIENT =
  'El faltante supera lo disponible en el almacén (el resto está reservado para despachos). Libera reservas o vuelve a contar.';

/**
 * T91 (US41): un conteo de validación. En curso se registra lo contado; al
 * finalizar se compara con el sistema; las diferencias se revisan con una nota
 * y se ajustan con un motivo. Se puede anular sin tocar el inventario.
 */
@Component({
  selector: 'app-count-detail-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      @if (count(); as c) {
        <div class="page-header">
          <div>
            <a class="eyebrow" routerLink="/stock/counts">Conteos</a>
            <h1>Conteo de {{ c.warehouseName }}</h1>
          </div>
          <span class="badge" [class]="'badge ' + badge()" data-testid="count-status">{{ statusLabel() }}</span>
        </div>
        @if (message()) {
          <p class="alert alert-success" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
        <dl class="kv">
          <div><dt>Inicio</dt><dd>{{ c.startedAt | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
          <div><dt>Fin del conteo</dt><dd>{{ c.finishedAt ? (c.finishedAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</dd></div>
          <div><dt>Diferencias</dt><dd>{{ c.status === 'IN_PROGRESS' ? '-' : c.differenceCount }}</dd></div>
          <div><dt>Observación</dt><dd>{{ c.note ?? '-' }}</dd></div>
        </dl>

        <div class="card">
          <h2>Materiales</h2>
          @if (c.status === 'IN_PROGRESS') {
            <p class="muted">Escribe lo que cuentas en el almacén. El saldo del sistema aparece al finalizar, para no condicionar el conteo.</p>
          }
          <div class="table-wrap">
            <table class="table" data-testid="count-lines">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Material</th>
                  <th class="num">Contado</th>
                  @if (c.status !== 'IN_PROGRESS') {
                    <th class="num">Sistema</th>
                    <th class="num">Diferencia</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of c.lines; track l.materialId) {
                  <tr [attr.data-material]="l.sku">
                    <td data-label="SKU" class="code">{{ l.sku ?? '-' }}</td>
                    <td data-label="Material">{{ l.materialName ?? '-' }}</td>
                    <td data-label="Contado" class="num">
                      @if (c.status === 'IN_PROGRESS') {
                        <input
                          class="qty"
                          type="number"
                          inputmode="decimal"
                          min="0"
                          step="0.001"
                          [attr.aria-label]="'Contado de ' + (l.materialName ?? l.sku)"
                          [value]="counted()[l.materialId] ?? ''"
                          (input)="setCounted(l.materialId, $any($event.target).value)"
                        />
                        <span class="muted">{{ l.unit }}</span>
                      } @else {
                        {{ l.countedQty === null ? '-' : (l.countedQty | number: '1.0-3') }} {{ l.unit }}
                      }
                    </td>
                    @if (c.status !== 'IN_PROGRESS') {
                      <td data-label="Sistema" class="num">{{ l.systemQty === null ? '-' : (l.systemQty | number: '1.0-3') }}</td>
                      <td data-label="Diferencia" class="num">
                        @if (l.difference === null || l.difference === 0) {
                          <span class="badge badge-ok">Sin diferencia</span>
                        } @else {
                          <span class="badge" [class]="l.difference < 0 ? 'badge badge-bad' : 'badge badge-info'">
                            {{ l.difference > 0 ? '+' : '' }}{{ l.difference | number: '1.0-3' }} {{ l.unit }}
                          </span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (c.status === 'IN_PROGRESS') {
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="finish()" data-testid="finish-count">
                <app-icon name="check" />
                Finalizar conteo
              </button>
              <button class="btn" type="button" [disabled]="busy()" (click)="save()">Guardar avance</button>
            </div>
          }
        </div>

        @if (c.reviewNote) {
          <div class="card">
            <h2>Revisión</h2>
            <p>{{ c.reviewNote }}</p>
            <p class="muted">{{ c.reviewedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
          </div>
        }
        @if (c.adjustmentReason) {
          <div class="card">
            <h2>Ajuste validado</h2>
            <p>{{ c.adjustmentReason }}</p>
            <p class="muted">{{ c.adjustedAt | date: 'dd/MM/yyyy HH:mm' }}. El inventario del almacén ya refleja lo contado.</p>
          </div>
        }

        @if (c.status === 'DIFFERENCES_FOUND') {
          <div class="card">
            <h2>Revisar diferencias</h2>
            <div class="field">
              <label for="review-note">Qué se revisó</label>
              <textarea id="review-note" rows="3" maxlength="500" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
              <span class="hint">Por ejemplo: «Se recontó dos veces; faltan 5 bolsas por rotura».</span>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="busy() || !note().trim()" (click)="review()" data-testid="review-count">
                Marcar como revisado
              </button>
            </div>
          </div>
        }
        @if (c.status === 'REVIEWED') {
          <div class="card">
            <h2>Validar ajuste</h2>
            <p class="muted">El ajuste suma o resta solo la diferencia encontrada, sin pisar las salidas posteriores al conteo.</p>
            <div class="field">
              <label for="adjust-reason">Motivo del ajuste</label>
              <textarea id="adjust-reason" rows="3" maxlength="500" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="busy() || !note().trim()" (click)="adjust()" data-testid="adjust-count">
                Validar ajuste
              </button>
            </div>
          </div>
        }
        @if (cancellable()) {
          <div class="form-actions">
            <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="cancel()">
              <app-icon name="x-circle" />
              Anular conteo
            </button>
          </div>
        }
      } @else if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      } @else {
        <p class="loading">Cargando conteo…</p>
      }
    </section>
  `,
  styles: `
    .qty {
      width: 120px;
      min-height: 44px;
      padding: 8px 10px;
      border: 1.5px solid var(--bs-junta);
      border-radius: var(--bs-radius-control);
      font: inherit;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CountDetailPageComponent implements OnInit {
  /** Id del conteo, desde la ruta. */
  readonly id = input.required<string>();

  private readonly api = inject(InventoryApiService);

  protected readonly count = signal<StockCount | null>(null);
  protected readonly counted = signal<Record<string, string | undefined>>({});
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly statusLabel = computed(() => {
    const c = this.count();
    return c ? (COUNT_STATUS_LABELS[c.status] ?? c.status) : '';
  });
  protected readonly badge = computed(() => {
    const c = this.count();
    return c ? countBadge(c.status) : '';
  });
  protected readonly cancellable = computed(() => {
    const status = this.count()?.status;
    return status === 'IN_PROGRESS' || status === 'DIFFERENCES_FOUND' || status === 'REVIEWED';
  });

  ngOnInit(): void {
    this.api.getCount(this.id()).subscribe({
      next: (count) => this.show(count),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected setCounted(materialId: string, value: string): void {
    this.counted.update((current) => ({...current, [materialId]: value}));
  }

  protected save(): void {
    const lines = this.filledLines();
    if (!lines.length) {
      this.error.set('Escribe lo contado de al menos un material.');
      return;
    }
    this.run(this.api.saveCountLines(this.id(), lines), 'Avance guardado.');
  }

  protected finish(): void {
    const count = this.count();
    const lines = this.filledLines();
    if (!count || lines.length < count.lines.length) {
      this.error.set('Escribe lo contado de todos los materiales antes de finalizar.');
      return;
    }
    this.run(
      this.api.saveCountLines(this.id(), lines).pipe(switchMap(() => this.api.finishCount(this.id()))),
      null,
    );
  }

  protected review(): void {
    this.run(this.api.reviewCount(this.id(), this.note().trim()), 'Diferencias revisadas. Falta validar el ajuste.');
  }

  protected adjust(): void {
    this.run(this.api.adjustCount(this.id(), this.note().trim()), 'Ajuste validado: el inventario quedó con lo contado.');
  }

  protected cancel(): void {
    this.run(this.api.cancelCount(this.id()), 'Conteo anulado. El inventario no cambió.');
  }

  private filledLines(): {materialId: string; countedQty: number}[] {
    const values = this.counted();
    return (this.count()?.lines ?? [])
      .filter((line) => values[line.materialId] !== undefined && `${values[line.materialId]}`.trim() !== '')
      .map((line) => ({materialId: line.materialId, countedQty: Number(values[line.materialId])}))
      .filter((line) => Number.isFinite(line.countedQty) && line.countedQty >= 0);
  }

  private run(action: Observable<StockCount>, okMessage: string | null): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    action.subscribe({
      next: (count) => {
        this.busy.set(false);
        this.show(count);
        this.note.set('');
        this.message.set(
          okMessage ??
            (count.status === 'MATCHED'
              ? 'Conteo finalizado sin diferencias: el inventario coincide.'
              : `Conteo finalizado con ${count.differenceCount} diferencia(s). Revísalas antes de ajustar.`),
        );
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const apiError = toApiError(err);
        this.error.set(apiError.code === 'INSUFFICIENT_STOCK' ? ADJUST_INSUFFICIENT : apiError.message);
      },
    });
  }

  private show(count: StockCount): void {
    this.count.set(count);
    const values: Record<string, string> = {};
    count.lines.forEach((line: StockCountLine) => {
      if (line.countedQty !== null) {
        values[line.materialId] = String(line.countedQty);
      }
    });
    this.counted.set(values);
  }
}

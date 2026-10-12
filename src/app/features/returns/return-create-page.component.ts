import {DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {OriginWarehouse, WorksiteBalance} from '../../core/models/inventory';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';

interface Draft {
  quantity: string;
  detail: string;
}

/**
 * T92 (US43): saldos de la obra y registro de la devolución. Muestra lo que la
 * obra tiene, lo comprometido en otras devoluciones y lo que todavía puede
 * devolver; el material vuelve al almacén que lo despachó.
 */
@Component({
  selector: 'app-return-create-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <a class="eyebrow" routerLink="/returns">Devoluciones</a>
          <h1>Saldos de la obra</h1>
        </div>
      </div>
      <p class="lead">
        Elige la obra, revisa su saldo y escribe cuánto devuelves de cada material. La devolución queda registrada; después
        la solicitas al almacén de origen.
      </p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <div class="field site-select">
        <label for="ret-worksite">Obra</label>
        <select id="ret-worksite" [value]="worksiteId()" (change)="selectWorksite($any($event.target).value)">
          <option value="">Elige la obra</option>
          @for (w of worksites(); track w.id) {
            <option [value]="w.id">{{ w.name }}</option>
          }
        </select>
      </div>

      @if (loadingBalance()) {
        <p class="loading">Cargando el saldo…</p>
      } @else if (balance()) {
        @if (balance(); as b) {
        @if (b.lines.length) {
          <div class="card">
            <h2>Saldo de {{ b.worksiteName }}</h2>
            <div class="table-wrap">
              <table class="table" data-testid="balance">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th class="num">En obra</th>
                    <th class="num">En otras devoluciones</th>
                    <th class="num">Se puede devolver</th>
                    <th>Almacén de origen</th>
                    <th class="num">Devolver</th>
                    <th>Estado del material</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of b.lines; track l.materialId) {
                    <tr [attr.data-material]="l.sku">
                      <td data-label="Material"><span class="code">{{ l.sku }}</span> {{ l.materialName }}</td>
                      <td data-label="En obra" class="num">{{ l.availableQty | number: '1.0-3' }} {{ l.unit }}</td>
                      <td data-label="En otras devoluciones" class="num">{{ l.pendingReturnQty | number: '1.0-3' }}</td>
                      <td data-label="Se puede devolver" class="num"><strong>{{ l.returnableQty | number: '1.0-3' }}</strong></td>
                      <td data-label="Almacén de origen">{{ originNames(l.originWarehouses) }}</td>
                      <td data-label="Devolver" class="num">
                        <input
                          class="qty"
                          type="number"
                          inputmode="decimal"
                          min="0"
                          step="0.001"
                          [max]="l.returnableQty"
                          [disabled]="l.returnableQty <= 0"
                          [attr.aria-label]="'Cantidad a devolver de ' + l.materialName"
                          [value]="drafts()[l.materialId]?.quantity ?? ''"
                          (input)="setDraft(l.materialId, 'quantity', $any($event.target).value)"
                        />
                      </td>
                      <td data-label="Estado del material">
                        <input
                          class="detail"
                          type="text"
                          maxlength="200"
                          placeholder="Por ejemplo, bolsas cerradas"
                          [attr.aria-label]="'Estado de ' + l.materialName"
                          [disabled]="l.returnableQty <= 0"
                          [value]="drafts()[l.materialId]?.detail ?? ''"
                          (input)="setDraft(l.materialId, 'detail', $any($event.target).value)"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="form-grid">
              @if (origins().length > 1) {
                <div class="field">
                  <label for="ret-origin">Almacén de destino</label>
                  <select id="ret-origin" [value]="warehouseId()" (change)="warehouseId.set($any($event.target).value)">
                    <option value="">Elige el almacén</option>
                    @for (o of origins(); track o.warehouseId) {
                      <option [value]="o.warehouseId">{{ o.warehouseName }}</option>
                    }
                  </select>
                  <span class="hint">Los materiales llegaron de varios almacenes. Registra una devolución por almacén.</span>
                </div>
              }
              <div class="field full">
                <label for="ret-note">Observación (opcional)</label>
                <input id="ret-note" maxlength="500" [value]="note()" (input)="note.set($any($event.target).value)" />
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="register()" data-testid="register-return">
                <app-icon name="return" />
                {{ saving() ? 'Registrando…' : 'Registrar devolución' }}
              </button>
            </div>
          </div>
        } @else {
          <div class="empty">
            <strong>La obra no tiene saldo</strong>
            <p>Cuando la obra reciba material, aquí verás lo que puede devolver.</p>
          </div>
        }
        }
      }
    </section>
  `,
  styles: `
    .site-select {
      max-width: 360px;
      margin-bottom: var(--bs-gap);
    }
    .qty,
    .detail {
      min-height: 44px;
      padding: 8px 10px;
      border: 1.5px solid var(--bs-junta);
      border-radius: var(--bs-radius-control);
      font: inherit;
    }
    .qty {
      width: 110px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .detail {
      width: 100%;
      min-width: 180px;
    }
  `,
})
export class ReturnCreatePageComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly organization = inject(OrganizationApiService);
  private readonly router = inject(Router);

  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly worksiteId = signal('');
  protected readonly balance = signal<WorksiteBalance | null>(null);
  protected readonly drafts = signal<Record<string, Draft | undefined>>({});
  protected readonly warehouseId = signal('');
  protected readonly note = signal('');
  protected readonly loadingBalance = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Almacenes de origen de los materiales que se van a devolver. */
  protected readonly origins = computed<OriginWarehouse[]>(() => {
    const drafts = this.drafts();
    const chosen = (this.balance()?.lines ?? []).filter((l) => Number(drafts[l.materialId]?.quantity) > 0);
    const lines = chosen.length ? chosen : (this.balance()?.lines ?? []);
    const unique = new Map<string, OriginWarehouse>();
    lines.forEach((l) => l.originWarehouses.forEach((o) => unique.set(o.warehouseId, o)));
    return [...unique.values()];
  });

  ngOnInit(): void {
    this.organization.listWorksites().subscribe({
      next: (list) => {
        this.worksites.set(list);
        if (list.length === 1) {
          this.selectWorksite(list[0].id);
        }
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected originNames(origins: OriginWarehouse[]): string {
    return origins.map((o) => o.warehouseName ?? '-').join(', ') || 'Sin registro';
  }

  protected selectWorksite(id: string): void {
    this.worksiteId.set(id);
    this.balance.set(null);
    this.drafts.set({});
    this.warehouseId.set('');
    this.error.set(null);
    if (!id) {
      return;
    }
    this.loadingBalance.set(true);
    this.inventory.worksiteBalance(id).subscribe({
      next: (balance) => {
        this.balance.set(balance);
        this.loadingBalance.set(false);
      },
      error: (err: unknown) => {
        this.loadingBalance.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected setDraft(materialId: string, field: keyof Draft, value: string): void {
    this.drafts.update((current) => ({
      ...current,
      [materialId]: {quantity: '', detail: '', ...current[materialId], [field]: value},
    }));
  }

  protected register(): void {
    const balance = this.balance();
    if (!balance) {
      return;
    }
    const drafts = this.drafts();
    const lines = balance.lines
      .filter((l) => Number(drafts[l.materialId]?.quantity) > 0)
      .map((l) => ({
        materialId: l.materialId,
        quantity: Number(drafts[l.materialId]?.quantity),
        detail: drafts[l.materialId]?.detail.trim() || null,
      }));
    if (!lines.length) {
      this.error.set('Escribe la cantidad a devolver de al menos un material.');
      return;
    }
    const over = balance.lines.find((l) => Number(drafts[l.materialId]?.quantity) > l.returnableQty);
    if (over) {
      this.error.set(`La cantidad de ${over.materialName} supera lo que la obra puede devolver.`);
      return;
    }
    if (this.origins().length > 1 && !this.warehouseId()) {
      this.error.set('Elige el almacén al que vuelve el material.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.inventory
      .registerReturn({
        worksiteId: balance.worksiteId,
        warehouseId: this.warehouseId() || null,
        note: this.note().trim() || null,
        lines,
      })
      .subscribe({
        next: (ret) => void this.router.navigate(['/returns', ret.id], {queryParams: {registrada: 1}}),
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(toApiError(err).message);
        },
      });
  }
}

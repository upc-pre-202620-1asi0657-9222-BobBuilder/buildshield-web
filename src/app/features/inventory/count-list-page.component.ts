import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {COUNT_STATUS_LABELS, CountStatus, StockCount} from '../../core/models/inventory';
import {Warehouse} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {InventoryTabsComponent} from './inventory-tabs.component';

/** Clase de insignia por estado del conteo. */
export function countBadge(status: CountStatus): string {
  switch (status) {
    case 'MATCHED':
    case 'ADJUSTED':
      return 'badge-ok';
    case 'DIFFERENCES_FOUND':
      return 'badge-bad';
    case 'IN_PROGRESS':
      return 'badge-info';
    case 'REVIEWED':
      return 'badge-warn';
    default:
      return '';
  }
}

/** T91 (US41): conteos de validación del almacén. */
@Component({
  selector: 'app-count-list-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, RouterLink, IconComponent, InventoryTabsComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Inventario</h1>
      </div>
      <app-inventory-tabs />
      <p class="lead">
        El conteo de validación compara lo que hay físicamente en el almacén con lo que registra el sistema. Las
        diferencias se revisan y, con un motivo, se ajustan.
      </p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <div class="card">
        <h2>Nuevo conteo</h2>
        <form [formGroup]="form" (ngSubmit)="start()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="c-warehouse">Almacén</label>
              <select id="c-warehouse" formControlName="warehouseId" aria-describedby="c-warehouseError">
                <option value="">Elige el almacén</option>
                @for (w of warehouses(); track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select>
              @if (form.controls.warehouseId.touched && form.controls.warehouseId.invalid) {
                <span class="error" id="c-warehouseError">Elige el almacén que vas a contar.</span>
              }
            </div>
            <div class="field">
              <label for="c-note">Motivo u observación (opcional)</label>
              <input id="c-note" formControlName="note" maxlength="200" autocomplete="off" />
            </div>
          </div>
          <p class="muted">Se cuentan todos los materiales con stock en el almacén. Solo puede haber un conteo en curso por almacén.</p>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()">
              <app-icon name="count" />
              {{ saving() ? 'Iniciando…' : 'Iniciar conteo' }}
            </button>
          </div>
        </form>
      </div>

      @if (loading()) {
        <p class="loading">Cargando conteos…</p>
      } @else if (counts().length) {
        <div class="card">
          <h2>Conteos</h2>
          <div class="table-wrap">
            <table class="table" data-testid="counts">
              <thead>
                <tr><th>Inicio</th><th>Almacén</th><th>Estado</th><th class="num">Diferencias</th><th>Observación</th><th></th></tr>
              </thead>
              <tbody>
                @for (c of counts(); track c.id) {
                  <tr>
                    <td data-label="Inicio">{{ c.startedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td data-label="Almacén">{{ c.warehouseName }}</td>
                    <td data-label="Estado"><span class="badge" [class]="'badge ' + badge(c.status)">{{ label(c.status) }}</span></td>
                    <td data-label="Diferencias" class="num">{{ c.differenceCount }}</td>
                    <td data-label="Observación">{{ c.note ?? '' }}</td>
                    <td class="row-actions"><a class="btn btn-ghost" [routerLink]="['/stock/counts', c.id]">Abrir</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>Aún no hay conteos</strong>
          <p>Inicia el primer conteo para validar el inventario del almacén.</p>
        </div>
      }
    </section>
  `,
})
export class CountListPageComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly organization = inject(OrganizationApiService);
  private readonly router = inject(Router);

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly counts = signal<StockCount[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    warehouseId: ['', Validators.required],
    note: [''],
  });

  ngOnInit(): void {
    this.organization.listWarehouses().subscribe({
      next: (list) => this.warehouses.set(list),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
    this.inventory.listCounts().subscribe({
      next: (list) => {
        this.counts.set([...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected label(status: CountStatus): string {
    return COUNT_STATUS_LABELS[status] ?? status;
  }

  protected badge(status: CountStatus): string {
    return countBadge(status);
  }

  protected start(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.inventory.startCount(value.warehouseId, value.note.trim() || null).subscribe({
      next: (count) => void this.router.navigate(['/stock/counts', count.id]),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

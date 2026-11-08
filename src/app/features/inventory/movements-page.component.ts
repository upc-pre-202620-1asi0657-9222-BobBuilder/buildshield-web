import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {forkJoin} from 'rxjs';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {MOVEMENT_FILTER_TYPES, MOVEMENT_TYPE_LABELS, MovementPage} from '../../core/models/inventory';
import {Material, Warehouse} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {InventoryTabsComponent} from './inventory-tabs.component';

export const MOVEMENTS_PAGE_SIZE = 20;

/** Inicio del día en Lima (UTC-5, sin horario de verano) como instante UTC ISO-8601. */
export function limaDayStart(date: string): string {
  return `${date}T05:00:00Z`;
}

/** Inicio del día siguiente en Lima: el «hasta» del historial es excluido. */
export function limaNextDayStart(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return limaDayStart(next.toISOString().slice(0, 10));
}

/** Clase de la insignia según el tipo de movimiento: entra (ok), sale (info) o ajusta. */
export function movementBadge(type: string): string {
  switch (type) {
    case 'INITIAL':
    case 'REPLENISHMENT':
    case 'ENTRY':
    case 'RETURN_IN':
    case 'ADJUSTMENT_IN':
      return 'badge-ok';
    case 'ADJUSTMENT_OUT':
      return 'badge-bad';
    case 'RESERVE':
    case 'RELEASE':
      return 'badge-warn';
    default:
      return 'badge-info';
  }
}

/** T90 (US40): historial de movimientos del almacén, filtrable y paginado. */
@Component({
  selector: 'app-movements-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, IconComponent, InventoryTabsComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Inventario</h1>
      </div>
      <app-inventory-tabs />
      <p class="lead">Cada entrada, salida, ajuste y devolución, con el saldo que dejó en el almacén o la obra.</p>

      <form class="card" [formGroup]="filters" (ngSubmit)="search()" novalidate>
        <div class="filter-grid">
          <div class="field">
            <label for="f-location">Almacén</label>
            <select id="f-location" formControlName="locationId">
              <option value="">Todos</option>
              @for (w of warehouses(); track w.id) {
                <option [value]="w.id">{{ w.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="f-material">Material</label>
            <select id="f-material" formControlName="materialId">
              <option value="">Todos</option>
              @for (m of materials(); track m.id) {
                <option [value]="m.id">{{ m.sku }} · {{ m.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="f-type">Tipo</label>
            <select id="f-type" formControlName="type">
              <option value="">Todos</option>
              @for (t of types; track t) {
                <option [value]="t">{{ typeLabel(t) }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="f-from">Desde</label>
            <input id="f-from" type="date" formControlName="from" />
          </div>
          <div class="field">
            <label for="f-to">Hasta</label>
            <input id="f-to" type="date" formControlName="to" />
          </div>
          <div class="field">
            <button class="btn btn-primary" type="submit">
              <app-icon name="refresh" />
              Filtrar
            </button>
          </div>
        </div>
      </form>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p class="loading">Cargando movimientos…</p>
      } @else if (result()) {
        @if (result(); as r) {
        @if (r.items.length) {
          <div class="card">
            <div class="table-wrap">
              <table class="table" data-testid="movements">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Lugar</th>
                    <th>SKU</th>
                    <th>Tipo</th>
                    <th class="num">Cantidad</th>
                    <th class="num">Saldo después</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of r.items; track m.id) {
                    <tr>
                      <td data-label="Fecha">{{ m.occurredAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td data-label="Lugar">{{ m.locationName ?? '-' }}</td>
                      <td data-label="SKU" class="code">{{ m.sku ?? '-' }}</td>
                      <td data-label="Tipo"><span class="badge" [class]="'badge ' + badge(m.type)">{{ typeLabel(m.type) }}</span></td>
                      <td data-label="Cantidad" class="num">{{ m.quantity | number: '1.0-3' }}</td>
                      <td data-label="Saldo después" class="num"><strong>{{ m.balanceAfter | number: '1.0-3' }}</strong></td>
                      <td data-label="Referencia">{{ m.reference ?? '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="pager">
              <span class="muted" data-testid="pager-status">
                Página {{ r.page + 1 }} de {{ pages() }} · {{ r.total }} movimientos
              </span>
              <div class="actions">
                <button class="btn" type="button" [disabled]="r.page === 0" (click)="go(r.page - 1)">Anterior</button>
                <button class="btn" type="button" [disabled]="r.page + 1 >= pages()" (click)="go(r.page + 1)">Siguiente</button>
              </div>
            </div>
          </div>
        } @else {
          <div class="empty">
            <strong>Sin movimientos</strong>
            <p>No hay movimientos con estos filtros. Cambia el periodo o registra una entrada en Existencias.</p>
          </div>
        }
        }
      }
    </section>
  `,
})
export class MovementsPageComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly organization = inject(OrganizationApiService);

  protected readonly types = MOVEMENT_FILTER_TYPES;
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly result = signal<MovementPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pages = computed(() => {
    const r = this.result();
    return r ? Math.max(1, Math.ceil(r.total / (r.size || MOVEMENTS_PAGE_SIZE))) : 1;
  });

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    locationId: [''],
    materialId: [''],
    type: [''],
    from: [''],
    to: [''],
  });

  ngOnInit(): void {
    forkJoin({warehouses: this.organization.listWarehouses(), materials: this.organization.listMaterials()}).subscribe({
      next: ({warehouses, materials}) => {
        this.warehouses.set(warehouses);
        this.materials.set(materials);
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
    this.go(0);
  }

  protected typeLabel(type: string): string {
    return MOVEMENT_TYPE_LABELS[type] ?? type;
  }

  protected badge(type: string): string {
    return movementBadge(type);
  }

  protected search(): void {
    this.go(0);
  }

  protected go(page: number): void {
    const f = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .movementHistory({
        locationId: f.locationId || undefined,
        materialId: f.materialId || undefined,
        type: f.type || undefined,
        from: f.from ? limaDayStart(f.from) : undefined,
        to: f.to ? limaNextDayStart(f.to) : undefined,
        page,
        size: MOVEMENTS_PAGE_SIZE,
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(toApiError(err).message);
        },
      });
  }
}

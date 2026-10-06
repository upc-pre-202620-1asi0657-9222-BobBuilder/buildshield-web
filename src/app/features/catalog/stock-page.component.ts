import {DecimalPipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {forkJoin} from 'rxjs';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Material, StockLevel, Warehouse} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';

/** Stock por almacén y registro de entradas (POST con Idempotency-Key automático). */
@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Stock</h1>
        <div class="actions">
          <button class="btn" type="button" (click)="focusField('warehouse')">
            <app-icon name="plus" />
            Nueva entrada
          </button>
        </div>
      </div>
      <p class="lead">
        Lo que hay en cada almacén. Lo reservado ya está comprometido con un despacho y no se puede volver a usar.
      </p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="loading">Cargando stock…</p>
      } @else if (stock().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Almacén</th>
                  <th>SKU</th>
                  <th>Material</th>
                  <th class="num">Disponible</th>
                  <th class="num">Reservado</th>
                </tr>
              </thead>
              <tbody>
                @for (s of stock(); track s.warehouseId + s.materialId) {
                  <tr>
                    <td data-label="Almacén">{{ s.warehouseName }}</td>
                    <td data-label="SKU" class="code">{{ s.sku }}</td>
                    <td data-label="Material">{{ s.materialName }}</td>
                    <td data-label="Disponible" class="num">
                      <strong>{{ s.availableQty | number: '1.0-3' }}</strong> {{ s.unit }}
                    </td>
                    <td data-label="Reservado" class="num">{{ s.reservedQty | number: '1.0-3' }} {{ s.unit }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>Aún no hay existencias</strong>
          <p>Registra lo que llega al almacén para poder despachar a las obras.</p>
          <button class="btn" type="button" (click)="focusField('warehouse')">
            <app-icon name="plus" />
            Registrar la primera entrada
          </button>
        </div>
      }

      <div class="card">
        <h2>Nueva entrada</h2>
        <p class="muted">Suma material al stock del almacén, por ejemplo cuando llega una compra del proveedor.</p>
        <form [formGroup]="form" (ngSubmit)="register()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="warehouse">Almacén</label>
              <select id="warehouse" formControlName="warehouseId" aria-describedby="warehouseError">
                <option value="">Elige el almacén</option>
                @for (w of warehouses(); track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select>
              @if (form.controls.warehouseId.touched && form.controls.warehouseId.invalid) {
                <span class="error" id="warehouseError">Elige el almacén que recibe el material.</span>
              }
            </div>
            <div class="field">
              <label for="material">Material</label>
              <select id="material" formControlName="materialId" aria-describedby="materialError">
                <option value="">Elige el material</option>
                @for (m of materials(); track m.id) {
                  <option [value]="m.id">{{ m.sku }} · {{ m.name }}</option>
                }
              </select>
              @if (form.controls.materialId.touched && form.controls.materialId.invalid) {
                <span class="error" id="materialError">Elige el material.</span>
              }
            </div>
            <div class="field">
              <label for="quantity">
                Cantidad
                @if (unitOf(form.controls.materialId.value); as unit) {
                  <span class="muted">({{ unit }})</span>
                }
              </label>
              <input
                id="quantity"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.001"
                formControlName="quantity"
                aria-describedby="quantityError"
              />
              @if (form.controls.quantity.touched && form.controls.quantity.invalid) {
                <span class="error" id="quantityError">La cantidad debe ser mayor que cero.</span>
              }
            </div>
            <div class="field">
              <label for="note">Guía u observación (opcional)</label>
              <input id="note" formControlName="note" maxlength="200" autocomplete="off" aria-describedby="noteHint" />
              <span class="hint" id="noteHint">Por ejemplo, el número de guía de remisión del proveedor.</span>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()">
              <app-icon name="check" />
              {{ saving() ? 'Registrando…' : 'Registrar entrada' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class StockPageComponent implements OnInit {
  private readonly api = inject(OrganizationApiService);

  protected readonly stock = signal<StockLevel[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    warehouseId: ['', Validators.required],
    materialId: ['', Validators.required],
    quantity: [0, [Validators.required, Validators.min(0.001)]],
    note: [''],
  });

  ngOnInit(): void {
    forkJoin({warehouses: this.api.listWarehouses(), materials: this.api.listMaterials()}).subscribe({
      next: ({warehouses, materials}) => {
        this.warehouses.set(warehouses);
        this.materials.set(materials);
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
    this.load();
  }

  /** Lleva el foco (y la vista) al primer campo del formulario de entrada. */
  protected focusField(id: string): void {
    document.getElementById(id)?.focus();
  }

  protected unitOf(materialId: string): string {
    return this.materials().find((m) => m.id === materialId)?.unit ?? '';
  }

  protected register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.registerStockEntry({...value, note: value.note || undefined}).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.patchValue({quantity: 0, note: ''});
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private load(): void {
    this.api.listStock().subscribe({
      next: (list) => {
        this.stock.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

import {DecimalPipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {forkJoin} from 'rxjs';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Material, StockLevel, Warehouse} from '../../core/models/organization';

/** Stock por almacén y registro de entradas (POST con Idempotency-Key automático). */
@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  template: `
    <section class="page">
      <div class="page-header"><h1>Stock</h1></div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      <div class="card">
        <h2>Registrar entrada</h2>
        <form [formGroup]="form" (ngSubmit)="register()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="warehouse">Almacén</label>
              <select id="warehouse" formControlName="warehouseId">
                <option value="">Selecciona…</option>
                @for (w of warehouses(); track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="material">Material</label>
              <select id="material" formControlName="materialId">
                <option value="">Selecciona…</option>
                @for (m of materials(); track m.id) {
                  <option [value]="m.id">{{ m.sku }} · {{ m.name }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="quantity">Cantidad</label>
              <input id="quantity" type="number" inputmode="decimal" min="0" step="0.001" formControlName="quantity" />
            </div>
            <div class="field">
              <label for="note">Guía u observación</label>
              <input id="note" formControlName="note" maxlength="200" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" [disabled]="saving()">Registrar entrada</button>
          </div>
        </form>
      </div>
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>Almacén</th><th>SKU</th><th>Material</th><th class="num">Disponible</th><th class="num">Reservado</th></tr>
          </thead>
          <tbody>
            @for (s of stock(); track s.warehouseId + s.materialId) {
              <tr>
                <td data-label="Almacén">{{ s.warehouseName }}</td>
                <td data-label="SKU">{{ s.sku }}</td>
                <td data-label="Material">{{ s.materialName }}</td>
                <td data-label="Disponible" class="num">{{ s.availableQty | number: '1.0-3' }} {{ s.unit }}</td>
                <td data-label="Reservado" class="num">{{ s.reservedQty | number: '1.0-3' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">{{ loading() ? 'Cargando…' : 'Sin existencias.' }}</td></tr>
            }
          </tbody>
        </table>
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

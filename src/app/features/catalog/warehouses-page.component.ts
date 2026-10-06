import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Warehouse, WarehouseType} from '../../core/models/organization';

const TYPE_LABELS: Readonly<Partial<Record<string, string>>> = {
  WAREHOUSE: 'Almacén',
  COLLECTION_CENTER: 'Centro de acopio',
};

/** T16: almacenes de la organización. Todos los ven; solo el administrador los registra. */
@Component({
  selector: 'app-warehouses-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page">
      <div class="page-header"><h1>Almacenes</h1></div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (canCreate()) {
        <div class="card">
          <h2>Nuevo almacén</h2>
          <form [formGroup]="form" (ngSubmit)="create()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="name">Nombre</label>
                <input id="name" formControlName="name" />
              </div>
              <div class="field">
                <label for="type">Tipo</label>
                <select id="type" formControlName="type">
                  <option value="WAREHOUSE">Almacén</option>
                  <option value="COLLECTION_CENTER">Centro de acopio</option>
                </select>
              </div>
              <div class="field">
                <label for="address">Dirección</label>
                <input id="address" formControlName="address" />
              </div>
            </div>
            @if (form.touched && form.invalid) {
              <p class="error">Completa nombre y dirección.</p>
            }
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">Registrar almacén</button>
            </div>
          </form>
        </div>
      }
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>Dirección</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (w of warehouses(); track w.id) {
              <tr>
                <td data-label="Nombre">{{ w.name }}</td>
                <td data-label="Tipo">{{ typeLabels[w.type] ?? w.type }}</td>
                <td data-label="Dirección">{{ w.address }}</td>
                <td data-label="Estado">
                  <span class="badge" [class.badge-ok]="w.active">{{ w.active ? 'Activo' : 'Inactivo' }}</span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">{{ loading() ? 'Cargando…' : 'No hay almacenes registrados.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class WarehousesPageComponent implements OnInit {
  private readonly api = inject(OrganizationApiService);
  private readonly auth = inject(AuthService);

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canCreate = computed(() => this.auth.role() === 'ADMINISTRATOR');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    type: ['WAREHOUSE' as WarehouseType, Validators.required],
    address: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.createWarehouse(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({type: 'WAREHOUSE'});
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private load(): void {
    this.api.listWarehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

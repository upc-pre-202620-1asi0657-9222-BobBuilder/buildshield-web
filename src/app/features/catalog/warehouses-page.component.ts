import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Warehouse, WarehouseType} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';

const TYPE_LABELS: Readonly<Partial<Record<string, string>>> = {
  WAREHOUSE: 'Almacén',
  COLLECTION_CENTER: 'Centro de acopio',
};

/** T16: almacenes de la organización. Todos los ven; solo el administrador los registra. */
@Component({
  selector: 'app-warehouses-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Almacenes</h1>
        @if (canCreate()) {
          <div class="actions">
            <button class="btn" type="button" (click)="focusField('name')">
              <app-icon name="plus" />
              Nuevo almacén
            </button>
          </div>
        }
      </div>
      <p class="lead">Lugares desde donde salen los materiales hacia las obras.</p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="loading">Cargando almacenes…</p>
      } @else if (warehouses().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Nombre</th><th>Tipo</th><th>Dirección</th><th>Estado</th></tr>
              </thead>
              <tbody>
                @for (w of warehouses(); track w.id) {
                  <tr>
                    <td data-label="Nombre"><strong>{{ w.name }}</strong></td>
                    <td data-label="Tipo">{{ typeLabels[w.type] ?? w.type }}</td>
                    <td data-label="Dirección">{{ w.address }}</td>
                    <td data-label="Estado">
                      <span class="badge" [class.badge-ok]="w.active">{{ w.active ? 'Activo' : 'Inactivo' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>Aún no hay almacenes</strong>
          @if (canCreate()) {
            <p>Registra al menos un almacén para que las obras puedan pedirle materiales.</p>
            <button class="btn" type="button" (click)="focusField('name')">
              <app-icon name="plus" />
              Registrar el primer almacén
            </button>
          } @else {
            <p>El administrador todavía no registra almacenes.</p>
          }
        </div>
      }

      @if (canCreate()) {
        <div class="card">
          <h2>Nuevo almacén</h2>
          <form [formGroup]="form" (ngSubmit)="create()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="name">Nombre</label>
                <input
                  id="name"
                  formControlName="name"
                  maxlength="150"
                  autocomplete="off"
                  aria-describedby="nameHint nameError"
                />
                <span class="hint" id="nameHint">Como lo conoce el equipo, por ejemplo «Almacén central Ate».</span>
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <span class="error" id="nameError">Escribe el nombre del almacén.</span>
                }
              </div>
              <div class="field">
                <label for="type">Tipo</label>
                <select id="type" formControlName="type">
                  <option value="WAREHOUSE">Almacén</option>
                  <option value="COLLECTION_CENTER">Centro de acopio</option>
                </select>
              </div>
              <div class="field full">
                <label for="address">Dirección</label>
                <input
                  id="address"
                  formControlName="address"
                  maxlength="200"
                  autocomplete="street-address"
                  aria-describedby="addressError"
                />
                @if (form.controls.address.touched && form.controls.address.invalid) {
                  <span class="error" id="addressError">Escribe la dirección del almacén.</span>
                }
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">
                <app-icon name="check" />
                {{ saving() ? 'Registrando…' : 'Registrar almacén' }}
              </button>
            </div>
          </form>
        </div>
      }
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

  /** Lleva el foco (y la vista) al primer campo del formulario de alta. */
  protected focusField(id: string): void {
    document.getElementById(id)?.focus();
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

import {DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Material, UNITS, UNIT_LABELS, UnitOfMeasure} from '../../core/models/organization';

/** T16: catálogo de materiales con SKU, unidad y tolerancia de merma (0 a 100). */
@Component({
  selector: 'app-materials-page',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe],
  template: `
    <section class="page">
      <div class="page-header"><h1>Materiales</h1></div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (canCreate()) {
        <div class="card">
          <h2>Nuevo material</h2>
          <form [formGroup]="form" (ngSubmit)="create()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="sku">SKU</label>
                <input id="sku" formControlName="sku" maxlength="40" />
                <span class="hint">Único en la organización, por ejemplo CEM-001.</span>
              </div>
              <div class="field">
                <label for="name">Nombre</label>
                <input id="name" formControlName="name" />
              </div>
              <div class="field">
                <label for="unit">Unidad</label>
                <select id="unit" formControlName="unit">
                  @for (unit of units; track unit) {
                    <option [value]="unit">{{ unitLabels[unit] }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="tolerance">Tolerancia de merma (%)</label>
                <input
                  id="tolerance"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  formControlName="wasteTolerancePercent"
                />
                @if (form.controls.wasteTolerancePercent.touched && form.controls.wasteTolerancePercent.invalid) {
                  <span class="error">La tolerancia debe estar entre 0 y 100.</span>
                }
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">Registrar material</button>
            </div>
          </form>
        </div>
      }
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>SKU</th><th>Nombre</th><th>Unidad</th><th class="num">Tolerancia</th><th>Estado</th></tr>
          </thead>
          <tbody>
            @for (m of materials(); track m.id) {
              <tr>
                <td data-label="SKU">{{ m.sku }}</td>
                <td data-label="Nombre">{{ m.name }}</td>
                <td data-label="Unidad">{{ unitLabels[m.unit] ?? m.unit }}</td>
                <td data-label="Tolerancia" class="num">{{ m.wasteTolerancePercent | number: '1.0-2' }} %</td>
                <td data-label="Estado">
                  <span class="badge" [class.badge-ok]="m.active">{{ m.active ? 'Activo' : 'Inactivo' }}</span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">{{ loading() ? 'Cargando…' : 'No hay materiales registrados.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class MaterialsPageComponent implements OnInit {
  private readonly api = inject(OrganizationApiService);
  private readonly auth = inject(AuthService);

  protected readonly units = UNITS;
  protected readonly unitLabels: Readonly<Partial<Record<string, string>>> = UNIT_LABELS;
  protected readonly materials = signal<Material[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canCreate = computed(() => this.auth.role() === 'ADMINISTRATOR');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    unit: ['BAG' as UnitOfMeasure, Validators.required],
    wasteTolerancePercent: [2, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createMaterial({...value, sku: value.sku.trim().toUpperCase(), name: value.name.trim()})
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.reset({unit: 'BAG', wasteTolerancePercent: 2});
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(toApiError(err).message);
        },
      });
  }

  private load(): void {
    this.api.listMaterials().subscribe({
      next: (list) => {
        this.materials.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

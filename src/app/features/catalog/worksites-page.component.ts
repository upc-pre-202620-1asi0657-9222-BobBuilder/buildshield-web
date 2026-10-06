import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {todayIso} from '../../shared/validators';

/** T16: obras de la organización. Todos las ven; solo el administrador las registra. */
@Component({
  selector: 'app-worksites-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Obras</h1>
        @if (canCreate()) {
          <div class="actions">
            <button class="btn" type="button" (click)="focusField('name')">
              <app-icon name="plus" />
              Nueva obra
            </button>
          </div>
        }
      </div>
      <p class="lead">Obras que reciben materiales. Cada encargado de obra ve solo las suyas.</p>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="loading">Cargando obras…</p>
      } @else if (worksites().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Nombre</th><th>Dirección</th><th>Distrito</th><th>Inicio</th><th>Fin</th></tr>
              </thead>
              <tbody>
                @for (w of worksites(); track w.id) {
                  <tr>
                    <td data-label="Nombre"><strong>{{ w.name }}</strong></td>
                    <td data-label="Dirección">{{ w.address }}</td>
                    <td data-label="Distrito">{{ w.district }}, {{ w.city }}</td>
                    <td data-label="Inicio">{{ w.startDate | date: 'dd/MM/yyyy' }}</td>
                    <td data-label="Fin">{{ w.endDate ? (w.endDate | date: 'dd/MM/yyyy') : 'Sin fecha' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>Aún no hay obras</strong>
          @if (canCreate()) {
            <p>Registra la primera obra para que su encargado pueda pedir y recibir materiales.</p>
            <button class="btn" type="button" (click)="focusField('name')">
              <app-icon name="plus" />
              Registrar la primera obra
            </button>
          } @else {
            <p>El administrador todavía no registra obras o no tienes ninguna asignada.</p>
          }
        </div>
      }

      @if (canCreate()) {
        <div class="card">
          <h2>Nueva obra</h2>
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
                <span class="hint" id="nameHint">Por ejemplo, «Edificio Los Álamos, torre B».</span>
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <span class="error" id="nameError">Escribe el nombre de la obra.</span>
                }
              </div>
              <div class="field">
                <label for="address">Dirección</label>
                <input
                  id="address"
                  formControlName="address"
                  maxlength="200"
                  autocomplete="street-address"
                  aria-describedby="addressError"
                />
                @if (form.controls.address.touched && form.controls.address.invalid) {
                  <span class="error" id="addressError">Escribe la dirección de la obra.</span>
                }
              </div>
              <div class="field">
                <label for="district">Distrito</label>
                <input
                  id="district"
                  formControlName="district"
                  maxlength="100"
                  autocomplete="address-level3"
                  aria-describedby="districtError"
                />
                @if (form.controls.district.touched && form.controls.district.invalid) {
                  <span class="error" id="districtError">Escribe el distrito.</span>
                }
              </div>
              <div class="field">
                <label for="city">Ciudad</label>
                <input
                  id="city"
                  formControlName="city"
                  maxlength="100"
                  autocomplete="address-level2"
                  aria-describedby="cityError"
                />
                @if (form.controls.city.touched && form.controls.city.invalid) {
                  <span class="error" id="cityError">Escribe la ciudad.</span>
                }
              </div>
              <div class="field">
                <label for="startDate">Fecha de inicio</label>
                <input id="startDate" type="date" formControlName="startDate" aria-describedby="startDateError" />
                @if (form.controls.startDate.touched && form.controls.startDate.invalid) {
                  <span class="error" id="startDateError">Indica cuándo empieza la obra.</span>
                }
              </div>
              <div class="field">
                <label for="endDate">Fecha de fin (opcional)</label>
                <input id="endDate" type="date" formControlName="endDate" aria-describedby="endDateHint" />
                <span class="hint" id="endDateHint">Déjala vacía si aún no se conoce.</span>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">
                <app-icon name="check" />
                {{ saving() ? 'Registrando…' : 'Registrar obra' }}
              </button>
            </div>
          </form>
        </div>
      }
    </section>
  `,
})
export class WorksitesPageComponent implements OnInit {
  private readonly api = inject(OrganizationApiService);
  private readonly auth = inject(AuthService);

  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canCreate = computed(() => this.auth.role() === 'ADMINISTRATOR');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', [Validators.required, Validators.maxLength(200)]],
    district: ['', [Validators.required, Validators.maxLength(100)]],
    city: ['Lima', [Validators.required, Validators.maxLength(100)]],
    startDate: [todayIso(), Validators.required],
    endDate: [''],
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
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.createWorksite({...value, endDate: value.endDate || null}).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({city: 'Lima', startDate: todayIso()});
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private load(): void {
    this.api.listWorksites().subscribe({
      next: (list) => {
        this.worksites.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

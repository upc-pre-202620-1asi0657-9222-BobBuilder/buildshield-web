import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Worksite} from '../../core/models/organization';
import {todayIso} from '../../shared/validators';

/** T16: obras de la organización. Todos las ven; solo el administrador las registra. */
@Component({
  selector: 'app-worksites-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <section class="page">
      <div class="page-header"><h1>Obras</h1></div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (canCreate()) {
        <div class="card">
          <h2>Nueva obra</h2>
          <form [formGroup]="form" (ngSubmit)="create()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="name">Nombre</label>
                <input id="name" formControlName="name" />
              </div>
              <div class="field">
                <label for="address">Dirección</label>
                <input id="address" formControlName="address" />
              </div>
              <div class="field">
                <label for="district">Distrito</label>
                <input id="district" formControlName="district" />
              </div>
              <div class="field">
                <label for="city">Ciudad</label>
                <input id="city" formControlName="city" />
              </div>
              <div class="field">
                <label for="startDate">Fecha de inicio</label>
                <input id="startDate" type="date" formControlName="startDate" />
              </div>
              <div class="field">
                <label for="endDate">Fecha de fin (opcional)</label>
                <input id="endDate" type="date" formControlName="endDate" />
              </div>
            </div>
            @if (form.touched && form.invalid) {
              <p class="error">Completa nombre, dirección, distrito, ciudad e inicio.</p>
            }
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" [disabled]="saving()">Registrar obra</button>
            </div>
          </form>
        </div>
      }
      <div class="card">
        <table class="table">
          <thead>
            <tr><th>Nombre</th><th>Dirección</th><th>Distrito</th><th>Inicio</th><th>Fin</th></tr>
          </thead>
          <tbody>
            @for (w of worksites(); track w.id) {
              <tr>
                <td data-label="Nombre">{{ w.name }}</td>
                <td data-label="Dirección">{{ w.address }}</td>
                <td data-label="Distrito">{{ w.district }}, {{ w.city }}</td>
                <td data-label="Inicio">{{ w.startDate | date: 'dd/MM/yyyy' }}</td>
                <td data-label="Fin">{{ w.endDate ? (w.endDate | date: 'dd/MM/yyyy') : '-' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="muted">{{ loading() ? 'Cargando…' : 'No hay obras registradas.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
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

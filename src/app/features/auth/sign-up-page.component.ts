import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {switchMap} from 'rxjs';

import {AuthService} from '../../core/auth/auth.service';
import {ApiErrorDetail, toApiError} from '../../core/http/api-error';
import {homeRouteFor} from '../../core/models/role';
import {PASSWORD_HINT, passwordRule, rucRule} from '../../shared/validators';

/** T06: registro de la organización y su administrador. */
@Component({
  selector: 'app-sign-up-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <aside class="auth-side" aria-hidden="true">
      <span class="side-brand"><img src="brand/mark-reverse.svg" alt="" width="40" height="40" />BuildShield</span>
      <p class="side-claim">Lo que sale del almacén, llega a la obra. Y si no llega, se sabe.</p>
      <p class="side-note">Despachos, recepción y merma por material, en una sola cuenta para toda la empresa.</p>
    </aside>
    <section class="auth-card">
      <img class="auth-logo" src="brand/mark.svg" alt="BuildShield" width="44" height="44" />
      <h1>Registra tu organización</h1>
      <p class="muted">Tú serás su administrador. La prueba gratuita incluye todas las funciones.</p>

      @if (error()) {
        <div class="alert alert-error" role="alert">
          {{ error() }}
          @for (detail of details(); track $index) {
            <div>{{ detail.field ? detail.field + ': ' : '' }}{{ detail.message }}</div>
          }
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="legalName">Razón social</label>
          <input id="legalName" formControlName="legalName" autocomplete="organization" />
          @if (form.controls.legalName.touched && form.controls.legalName.invalid) {
            <span class="error">Ingresa la razón social (máximo 200 caracteres).</span>
          }
        </div>
        <div class="field">
          <label for="ruc">RUC</label>
          <input id="ruc" formControlName="ruc" inputmode="numeric" maxlength="11" />
          @if (form.controls.ruc.touched && form.controls.ruc.invalid) {
            <span class="error">El RUC debe tener 11 dígitos.</span>
          }
        </div>
        <div class="field">
          <label for="adminFullName">Nombre del administrador</label>
          <input id="adminFullName" formControlName="adminFullName" autocomplete="name" />
          @if (form.controls.adminFullName.touched && form.controls.adminFullName.invalid) {
            <span class="error">Ingresa el nombre (máximo 150 caracteres).</span>
          }
        </div>
        <div class="field">
          <label for="adminEmail">Correo del administrador</label>
          <input id="adminEmail" type="email" formControlName="adminEmail" autocomplete="email" />
          @if (form.controls.adminEmail.touched && form.controls.adminEmail.invalid) {
            <span class="error">Ingresa un correo válido.</span>
          }
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
          <span class="hint">{{ passwordHint }}</span>
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <span class="error">La contraseña no cumple la regla.</span>
          }
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
          {{ loading() ? 'Registrando…' : 'Registrar organización' }}
        </button>
      </form>

      <p class="switch">¿Ya tienes cuenta? <a routerLink="/sign-in">Inicia sesión</a></p>
    </section>
  `,
  styleUrl: './auth-page.scss',
})
export class SignUpPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly passwordHint = PASSWORD_HINT;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    ruc: ['', [Validators.required, rucRule]],
    adminFullName: ['', [Validators.required, Validators.maxLength(150)]],
    adminEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, passwordRule]],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly details = signal<readonly ApiErrorDetail[]>([]);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    const request = {
      legalName: value.legalName.trim(),
      ruc: value.ruc.trim(),
      adminFullName: value.adminFullName.trim(),
      adminEmail: value.adminEmail.trim(),
      password: value.password,
    };
    this.auth
      .signUp(request)
      .pipe(switchMap(() => this.auth.signIn({email: request.adminEmail, password: request.password})))
      .subscribe({
        next: (session) => void this.router.navigateByUrl(homeRouteFor(session.role)),
        error: (err: unknown) => {
          const apiError = toApiError(err);
          this.loading.set(false);
          this.error.set(apiError.message);
          this.details.set(apiError.details);
        },
      });
  }
}

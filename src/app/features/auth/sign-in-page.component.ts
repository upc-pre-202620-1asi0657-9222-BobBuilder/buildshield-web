import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';

import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {homeRouteFor} from '../../core/models/role';

/** T08: inicio de sesión con redirección según el rol. */
@Component({
  selector: 'app-sign-in-page',
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
      <h1>Inicia sesión</h1>
      <p class="muted">Trazabilidad de materiales entre almacén y obra.</p>

      @if (expired) {
        <p class="alert alert-warning" role="status">Tu sesión venció. Vuelve a iniciar sesión.</p>
      }
      @if (registered) {
        <p class="alert alert-success" role="status">Organización registrada. Ya puedes ingresar.</p>
      }
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="email">Correo</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="error">Ingresa un correo válido.</span>
          }
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <span class="error">Ingresa tu contraseña.</span>
          }
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="loading()">
          {{ loading() ? 'Ingresando…' : 'Iniciar sesión' }}
        </button>
      </form>

      <p class="switch">
        ¿Tu empresa aún no usa BuildShield? <a routerLink="/sign-up">Registra tu organización</a>
      </p>
    </section>
  `,
  styleUrl: './auth-page.scss',
})
export class SignInPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expired = this.route.snapshot.queryParamMap.has('expired');
  protected readonly registered = this.route.snapshot.queryParamMap.has('registered');

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const {email, password} = this.form.getRawValue();
    this.auth.signIn({email: email.trim(), password}).subscribe({
      next: (session) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = returnUrl && returnUrl.startsWith('/') ? returnUrl : homeRouteFor(session.role);
        void this.router.navigateByUrl(target);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

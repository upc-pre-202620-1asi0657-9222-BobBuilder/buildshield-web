import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Observable, forkJoin} from 'rxjs';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Assignment, SiteType, User, Warehouse, Worksite} from '../../core/models/organization';
import {ROLES, ROLE_LABELS, Role} from '../../core/models/role';
import {IconComponent} from '../../shared/icon.component';
import {PASSWORD_HINT, passwordRule} from '../../shared/validators';

/** T12: usuarios de la organización (solo administrador): listar, crear con rol y asignar sede. */
@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(OrganizationApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly passwordHint = PASSWORD_HINT;

  protected readonly users = signal<User[]>([]);
  protected readonly assignments = signal<Assignment[]>([]);
  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: ['WAREHOUSE_MANAGER' as Role, Validators.required],
    password: ['', [Validators.required, passwordRule]],
  });

  protected readonly assignForm = this.fb.group({
    userId: ['', Validators.required],
    siteId: ['', Validators.required],
  });

  /** Encargados a los que se puede asignar una sede. */
  protected readonly managers = computed(() =>
    this.users().filter((u) => u.role !== 'ADMINISTRATOR' && u.active),
  );

  ngOnInit(): void {
    this.load();
  }

  /** Lleva el foco (y la vista) a un campo del formulario. */
  protected focusField(id: string): void {
    document.getElementById(id)?.focus();
  }

  protected siteOptionsFor(userId: string): Array<{id: string; name: string}> {
    const user = this.users().find((u) => u.id === userId);
    if (!user) {
      return [];
    }
    return user.role === 'SITE_MANAGER' ? this.worksites() : this.warehouses();
  }

  protected assignmentsOf(userId: string): string {
    const names = this.assignments()
      .filter((a) => a.userId === userId && a.active)
      .map((a) => this.siteName(a.siteType, a.siteId));
    return names.length ? names.join(', ') : 'Sin asignar';
  }

  protected createUser(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.run(
      this.api.createUser({...value, fullName: value.fullName.trim(), email: value.email.trim()}),
      `Usuario ${value.email} creado.`,
      () => this.form.reset({role: 'WAREHOUSE_MANAGER'}),
    );
  }

  protected assign(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }
    const {userId, siteId} = this.assignForm.getRawValue();
    const user = this.users().find((u) => u.id === userId);
    const siteType: SiteType = user?.role === 'SITE_MANAGER' ? 'WORKSITE' : 'WAREHOUSE';
    this.run(
      this.api.createAssignment({userId, siteId, siteType}),
      'Asignación registrada.',
      () => this.assignForm.reset(),
    );
  }

  private run(
    request: Observable<unknown>,
    message: string,
    onDone: () => void,
  ): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(message);
        onDone();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private siteName(type: SiteType, id: string): string {
    const list: Array<{id: string; name: string}> =
      type === 'WORKSITE' ? this.worksites() : this.warehouses();
    return list.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      users: this.api.listUsers(),
      assignments: this.api.listAssignments(),
      worksites: this.api.listWorksites(),
      warehouses: this.api.listWarehouses(),
    }).subscribe({
      next: (data) => {
        this.users.set(data.users);
        this.assignments.set(data.assignments);
        this.worksites.set(data.worksites);
        this.warehouses.set(data.warehouses);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

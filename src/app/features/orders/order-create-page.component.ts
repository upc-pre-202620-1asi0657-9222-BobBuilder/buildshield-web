import {Component, OnInit, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {forkJoin} from 'rxjs';

import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {Material, Warehouse, Worksite} from '../../core/models/organization';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';
import {todayIso} from '../../shared/validators';

/** T19: el encargado de obra pide materiales a un almacén. */
@Component({
  selector: 'app-order-create-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './order-create-page.component.html',
  styles: `
    .section-title {
      margin-top: 28px;
    }
    .line {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px 0;
      border-bottom: 1px solid var(--bs-color-border);
    }
    .line:first-child {
      padding-top: 0;
    }
    @media (min-width: 720px) {
      .line {
        grid-template-columns: 2fr 1fr auto;
        align-items: end;
      }
    }
    .add-line {
      margin-top: 16px;
    }
    .form-error {
      margin: 16px 0 0;
      color: var(--bs-merma);
      font-weight: 500;
    }
  `,
})
export class OrderCreatePageComponent implements OnInit {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly materials = signal<Material[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly minDate = todayIso();

  /** Se reusa si el usuario reintenta el mismo pedido tras un error. */
  private idempotencyKey = generateUuid();

  protected readonly form = this.fb.group({
    worksiteId: ['', Validators.required],
    warehouseId: ['', Validators.required],
    requiredDate: [todayIso(), Validators.required],
    notes: ['', Validators.maxLength(400)],
    lines: this.fb.array([this.newLine()]),
  });

  get lines() {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    forkJoin({
      worksites: this.orgApi.listWorksites(),
      warehouses: this.orgApi.listWarehouses(),
      materials: this.orgApi.listMaterials(),
    }).subscribe({
      next: ({worksites, warehouses, materials}) => {
        this.worksites.set(worksites);
        this.warehouses.set(warehouses.filter((w) => w.active));
        this.materials.set(materials.filter((m) => m.active));
        if (worksites.length === 1) {
          this.form.controls.worksiteId.setValue(worksites[0].id);
        }
      },
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
    this.form.valueChanges.subscribe(() => {
      // Datos distintos = operación distinta: nueva clave de idempotencia.
      this.idempotencyKey = generateUuid();
    });
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  protected unitOf(materialId: string): string {
    return this.materials().find((m) => m.id === materialId)?.unit ?? '';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const ids = value.lines.map((l) => l.materialId);
    if (new Set(ids).size !== ids.length) {
      this.error.set('Un material no puede repetirse en el mismo pedido.');
      return;
    }
    const notes = [`Fecha requerida: ${value.requiredDate}`, value.notes.trim()]
      .filter(Boolean)
      .join('. ');
    this.saving.set(true);
    this.error.set(null);
    this.ordersApi
      .place(
        {
          worksiteId: value.worksiteId,
          warehouseId: value.warehouseId,
          requiredDate: value.requiredDate,
          notes,
          lines: value.lines.map((l) => ({materialId: l.materialId, quantity: Number(l.quantity)})),
        },
        this.idempotencyKey,
      )
      .subscribe({
        next: (order) => void this.router.navigate(['/orders', order.id]),
        error: (err: unknown) => {
          const apiError = toApiError(err);
          this.saving.set(false);
          this.error.set(apiError.message);
          if (!shouldReuseIdempotencyKey(apiError)) {
            this.idempotencyKey = generateUuid();
          }
        },
      });
  }

  private newLine() {
    return this.fb.group({
      materialId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
    });
  }
}

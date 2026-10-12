import {Component, OnInit, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {
  RecipientSettingsApiService,
  RecipientTypeSetting,
  WorksiteRecipientSettings,
} from '../../core/api/recipient-settings-api.service';
import {toApiError} from '../../core/http/api-error';
import {ROLE_LABELS, isRole} from '../../core/models/role';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';

/**
 * T81 (US45): el administrador elige, por obra y por tipo de aviso, quién lo
 * recibe. Sin configuración se aplica la regla por rol; con configuración,
 * los elegidos la reemplazan.
 */
@Component({
  selector: 'app-recipient-settings-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <a class="eyebrow" routerLink="/notifications">Notificaciones</a>
          <h1>Destinatarios de avisos</h1>
        </div>
      </div>
      <p class="lead">
        Por defecto, cada aviso llega a los roles responsables de la obra. Si eliges personas para un aviso, solo ellas lo
        reciben en esa obra. Quien abrió una discrepancia siempre recibe los avisos de su caso.
      </p>
      @if (message()) {
        <p class="alert alert-success" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <div class="field site-select">
        <label for="rs-worksite">Obra</label>
        <select id="rs-worksite" [value]="worksiteId()" (change)="select($any($event.target).value)">
          <option value="">Elige la obra</option>
          @for (w of worksites(); track w.id) {
            <option [value]="w.id">{{ w.name }}</option>
          }
        </select>
      </div>

      @if (loading()) {
        <p class="loading">Cargando destinatarios…</p>
      } @else if (settings()) {
        @if (settings(); as s) {
        @for (t of s.types; track t.type) {
          <fieldset class="card" [attr.data-type]="t.type">
            <legend class="visually-hidden">{{ t.label }}</legend>
            <h2>
              {{ t.label }}
              @if (t.configured) {
                <span class="badge badge-info">Personalizado</span>
              } @else {
                <span class="badge badge-plain">Por defecto</span>
              }
            </h2>
            <p class="muted">Por defecto: {{ t.defaultAudience }}.</p>
            @if (s.candidates.length) {
              <ul class="list-plain people">
                @for (c of s.candidates; track c.userId) {
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        [checked]="isChosen(t.type, c.userId)"
                        (change)="toggle(t.type, c.userId, $any($event.target).checked)"
                      />
                      <span>
                        <strong>{{ c.fullName }}</strong>
                        <span class="muted">{{ roleLabel(c.role) }} · {{ c.email }}</span>
                      </span>
                    </label>
                  </li>
                }
              </ul>
            } @else {
              <p class="muted">No hay usuarios activos que puedan recibir avisos de esta obra.</p>
            }
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="saving() === t.type" (click)="save(t)">
                <app-icon name="check" />
                {{ saving() === t.type ? 'Guardando…' : 'Guardar destinatarios' }}
              </button>
              @if (t.configured) {
                <button class="btn btn-ghost" type="button" [disabled]="saving() === t.type" (click)="reset(t)">
                  Volver a lo predeterminado
                </button>
              }
            </div>
          </fieldset>
        }
        }
      } @else if (!error()) {
        <div class="empty">
          <strong>Elige una obra</strong>
          <p>Los destinatarios se configuran por obra, porque cada obra tiene su propio equipo.</p>
        </div>
      }
    </section>
  `,
  styles: `
    .site-select {
      max-width: 360px;
      margin-bottom: var(--bs-gap);
    }
    h2 .badge {
      margin-left: 8px;
    }
    .people {
      display: grid;
      gap: 4px;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      label {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: var(--bs-touch);
        padding: 4px 8px;
        border-radius: var(--bs-radius-control);
        cursor: pointer;
      }
      label:hover {
        background: var(--bs-concreto);
      }
      input {
        width: 20px;
        height: 20px;
        flex: none;
        accent-color: var(--bs-asfalto);
      }
      span {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .muted {
        font-size: 0.875rem;
      }
    }
  `,
})
export class RecipientSettingsPageComponent implements OnInit {
  private readonly api = inject(RecipientSettingsApiService);
  private readonly organization = inject(OrganizationApiService);

  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly worksiteId = signal('');
  protected readonly settings = signal<WorksiteRecipientSettings | null>(null);
  /** Elegidos por tipo de aviso (borrador antes de guardar). */
  protected readonly chosen = signal<Record<string, readonly string[]>>({});
  protected readonly loading = signal(false);
  protected readonly saving = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  ngOnInit(): void {
    this.organization.listWorksites().subscribe({
      next: (list) => this.worksites.set(list),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected roleLabel(role: string): string {
    return isRole(role) ? ROLE_LABELS[role] : role;
  }

  protected select(worksiteId: string): void {
    this.worksiteId.set(worksiteId);
    this.settings.set(null);
    this.message.set(null);
    this.error.set(null);
    if (!worksiteId) {
      return;
    }
    this.loading.set(true);
    this.api.forWorksite(worksiteId).subscribe({
      next: (settings) => {
        this.settings.set(settings);
        const chosen: Record<string, readonly string[]> = {};
        settings.types.forEach((t) => (chosen[t.type] = t.configured ? t.recipients.map((r) => r.userId) : []));
        this.chosen.set(chosen);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected isChosen(type: string, userId: string): boolean {
    return this.chosen()[type]?.includes(userId) ?? false;
  }

  protected toggle(type: string, userId: string, checked: boolean): void {
    this.chosen.update((current) => {
      const list = (current[type] ?? []).filter((id) => id !== userId);
      return {...current, [type]: checked ? [...list, userId] : list};
    });
  }

  protected save(setting: RecipientTypeSetting): void {
    const userIds = [...(this.chosen()[setting.type] ?? [])];
    this.saving.set(setting.type);
    this.error.set(null);
    this.message.set(null);
    this.api.replace(this.worksiteId(), setting.type, userIds).subscribe({
      next: (updated) => {
        this.saving.set(null);
        this.replaceType(updated);
        this.message.set(
          userIds.length
            ? `«${updated.label}»: ${userIds.length} destinatario(s) guardados para esta obra.`
            : `«${updated.label}»: sin destinatarios por rol en esta obra.`,
        );
      },
      error: (err: unknown) => {
        this.saving.set(null);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected reset(setting: RecipientTypeSetting): void {
    this.saving.set(setting.type);
    this.error.set(null);
    this.message.set(null);
    this.api.reset(this.worksiteId(), setting.type).subscribe({
      next: () => {
        this.saving.set(null);
        this.replaceType({...setting, configured: false, recipients: []});
        this.chosen.update((current) => ({...current, [setting.type]: []}));
        this.message.set(`«${setting.label}»: vuelve a llegar a ${setting.defaultAudience.toLowerCase()}.`);
      },
      error: (err: unknown) => {
        this.saving.set(null);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private replaceType(updated: RecipientTypeSetting): void {
    this.settings.update((s) =>
      s ? {...s, types: s.types.map((t) => (t.type === updated.type ? updated : t))} : s,
    );
  }
}

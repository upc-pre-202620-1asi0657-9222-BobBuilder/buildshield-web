import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {Router} from '@angular/router';

import {NotificationsApi} from '../../core/api/notifications-api';
import {toApiError} from '../../core/http/api-error';
import {AppNotification} from '../../core/models/notification';
import {IconComponent} from '../../shared/icon.component';
import {elapsedSince} from '../../shared/time';
import {UnreadNotificationsService} from './unread-notifications.service';

export const NOTIFICATIONS_PAGE_SIZE = 20;

/** US43: bandeja de notificaciones del usuario, con marcar como leídas. */
@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Notificaciones</h1>
        <div class="actions">
          <button class="btn mark-all" type="button" (click)="markAll()" [disabled]="busy() || unread.count() === 0">
            <app-icon name="check-all" />
            Marcar todas como leídas
          </button>
        </div>
      </div>
      <p class="lead">Avisos de los despachos, incidencias y discrepancias que te tocan.</p>

      <div class="filters" role="group" aria-label="Filtrar notificaciones">
        <button type="button" class="chip" [class.on]="!unreadOnly()" [attr.aria-pressed]="!unreadOnly()" (click)="setUnreadOnly(false)">
          Todas
        </button>
        <button type="button" class="chip" [class.on]="unreadOnly()" [attr.aria-pressed]="unreadOnly()" (click)="setUnreadOnly(true)">
          No leídas ({{ unread.count() }})
        </button>
      </div>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading() && items().length === 0) {
        <p class="loading">Cargando notificaciones…</p>
      } @else if (items().length) {
        <ul class="list-plain inbox">
          @for (n of items(); track n.id) {
            <li [class.unread]="n.readAt === null" [attr.data-notification]="n.id">
              <button type="button" class="item" (click)="open(n)">
                <span class="title">
                  @if (n.readAt === null) {
                    <span class="dot" aria-hidden="true"></span>
                    <span class="visually-hidden">No leída:</span>
                  }
                  {{ n.title }}
                </span>
                <span class="body">{{ n.body }}</span>
                <time class="when" [attr.datetime]="n.createdAt" [title]="n.createdAt | date: 'dd/MM/yyyy HH:mm'">
                  hace {{ ago(n.createdAt) }}
                </time>
              </button>
            </li>
          }
        </ul>
        @if (items().length < total()) {
          <button class="btn btn-block more" type="button" (click)="loadMore()" [disabled]="loading()">
            {{ loading() ? 'Cargando…' : 'Ver más' }}
          </button>
        }
      } @else {
        <div class="empty">
          <app-icon name="bell" />
          <strong>{{ unreadOnly() ? 'Todo leído' : 'Sin notificaciones' }}</strong>
          <p>Aquí llegan los avisos de despachos en camino, incidencias en ruta y cambios en las discrepancias.</p>
        </div>
      }
    </section>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chip {
      min-height: 40px;
      padding: 0 16px;
      border: 1.5px solid var(--bs-junta);
      border-radius: 999px;
      background: var(--bs-losa);
      color: var(--bs-asfalto);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .chip.on {
      background: var(--bs-asfalto);
      border-color: var(--bs-asfalto);
      color: #fff;
    }
    .inbox {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
    }
    .item {
      display: grid;
      gap: 2px;
      width: 100%;
      padding: 14px 16px;
      border: 1px solid var(--bs-junta);
      border-radius: var(--bs-radius);
      background: var(--bs-losa);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .item:hover {
      border-color: var(--bs-asfalto);
    }
    .item:focus-visible {
      outline: none;
      box-shadow: var(--bs-ring);
    }
    .unread .item {
      border-left: 6px solid var(--bs-senal);
    }
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .unread .title {
      font-weight: 700;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--bs-merma);
    }
    .body {
      color: var(--bs-acero);
    }
    .when {
      font-size: 0.8125rem;
      color: var(--bs-acero);
    }
  `,
})
export class NotificationsPageComponent implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly router = inject(Router);
  protected readonly unread = inject(UnreadNotificationsService);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly total = signal(0);
  protected readonly unreadOnly = signal(false);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private page = 0;

  ngOnInit(): void {
    this.load(0);
  }

  protected ago(iso: string): string {
    return elapsedSince(iso);
  }

  protected setUnreadOnly(value: boolean): void {
    this.unreadOnly.set(value);
    this.load(0);
  }

  protected loadMore(): void {
    this.load(this.page + 1);
  }

  /** Marca la notificación como leída y abre la pantalla a la que apunta. */
  protected open(n: AppNotification): void {
    if (n.readAt === null) {
      const now = new Date().toISOString();
      this.items.update((list) => list.map((x) => (x.id === n.id ? {...x, readAt: now} : x)));
      this.unread.decrement();
      this.api.markRead(n.id).subscribe({error: () => this.unread.refresh()});
    }
    if (n.link) {
      void this.router.navigateByUrl(n.link);
    }
  }

  protected markAll(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.markAllRead().subscribe({
      next: () => {
        this.busy.set(false);
        this.unread.set(0);
        if (this.unreadOnly()) {
          this.load(0);
        } else {
          const now = new Date().toISOString();
          this.items.update((list) => list.map((x) => ({...x, readAt: x.readAt ?? now})));
        }
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({unreadOnly: this.unreadOnly(), page, size: NOTIFICATIONS_PAGE_SIZE}).subscribe({
      next: (result) => {
        this.page = page;
        this.items.update((list) => (page === 0 ? result.items : [...list, ...result.items]));
        this.total.set(result.total);
        this.unread.set(result.unreadCount);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

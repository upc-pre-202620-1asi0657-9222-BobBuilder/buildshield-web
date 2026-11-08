import {Injectable} from '@angular/core';
import {Observable, defer, delay, of} from 'rxjs';

import {AppNotification, NotificationPage, NotificationQuery} from '../models/notification';
import {generateUuid} from '../util/uuid';
import {NotificationsApi} from './notifications-api';

const LATENCY_MS = 200;

/** Bandeja simulada en memoria para demos sin backend (environment.mockSprint2). */
@Injectable()
export class MockNotificationsApi extends NotificationsApi {
  private items: AppNotification[] = seed();

  override list(query: NotificationQuery = {}): Observable<NotificationPage> {
    return this.respond(() => {
      const page = query.page ?? 0;
      const size = query.size ?? 20;
      const filtered = this.items.filter((n) => !query.unreadOnly || n.readAt === null);
      return {
        items: filtered.slice(page * size, page * size + size).map((n) => ({...n})),
        unreadCount: this.unread(),
        page,
        size,
        total: filtered.length,
      };
    });
  }

  override unreadCount(): Observable<number> {
    return this.respond(() => this.unread());
  }

  override markRead(id: string): Observable<void> {
    return this.respond(() => {
      const item = this.items.find((n) => n.id === id);
      if (item && item.readAt === null) {
        item.readAt = new Date().toISOString();
      }
    });
  }

  override markAllRead(): Observable<void> {
    return this.respond(() => {
      const now = new Date().toISOString();
      for (const item of this.items) {
        item.readAt ??= now;
      }
    });
  }

  private unread(): number {
    return this.items.filter((n) => n.readAt === null).length;
  }

  private respond<T>(work: () => T): Observable<T> {
    return defer(() => of(work())).pipe(delay(LATENCY_MS));
  }
}

function seed(): AppNotification[] {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  return [
    {
      id: generateUuid(),
      type: 'DISPATCH_IN_TRANSIT',
      title: 'Despacho en camino',
      body: 'El despacho MAN-DEMO-0001 salió del almacén hacia Torre Norte (demo).',
      link: '/reception',
      createdAt: minutesAgo(12),
      readAt: null,
    },
    {
      id: generateUuid(),
      type: 'DISCREPANCY_RESPONDED',
      title: 'Discrepancia respondida',
      body: 'El almacén respondió una discrepancia que abriste.',
      link: '/discrepancies',
      createdAt: minutesAgo(180),
      readAt: minutesAgo(90),
    },
  ];
}

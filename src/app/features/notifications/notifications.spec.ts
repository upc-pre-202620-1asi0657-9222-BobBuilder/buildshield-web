import {TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
import {Subject, of, throwError} from 'rxjs';

import {NotificationsApi} from '../../core/api/notifications-api';
import {AppNotification} from '../../core/models/notification';
import {NotificationsPageComponent} from './notifications-page.component';
import {UnreadNotificationsService} from './unread-notifications.service';

function notification(id: string, readAt: string | null, link: string | null = null): AppNotification {
  return {id, type: 'DISPATCH_IN_TRANSIT', title: `Aviso ${id}`, body: 'Cuerpo', link, createdAt: new Date().toISOString(), readAt};
}

describe('UnreadNotificationsService', () => {
  it('consulta el contador, conserva el último valor ante errores y no duplica consultas en curso', () => {
    const pending = new Subject<number>();
    const api = jasmine.createSpyObj<NotificationsApi>('NotificationsApi', ['unreadCount']);
    api.unreadCount.and.returnValues(of(3), throwError(() => new Error('red')), pending);
    TestBed.configureTestingModule({providers: [{provide: NotificationsApi, useValue: api}]});
    const service = TestBed.inject(UnreadNotificationsService);

    service.refresh();
    expect(service.count()).toBe(3);
    service.refresh();
    expect(service.count()).toBe(3);
    service.refresh();
    service.refresh();
    expect(api.unreadCount).toHaveBeenCalledTimes(3);
    pending.next(5);
    pending.complete();
    expect(service.count()).toBe(5);
    service.decrement();
    expect(service.count()).toBe(4);
  });
});

describe('NotificationsPageComponent (US43)', () => {
  let api: jasmine.SpyObj<NotificationsApi>;
  let router: Router;

  function create() {
    TestBed.configureTestingModule({
      imports: [NotificationsPageComponent],
      providers: [provideRouter([]), {provide: NotificationsApi, useValue: api}],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(NotificationsPageComponent);
    fixture.detectChanges();
    return {fixture, element: fixture.nativeElement as HTMLElement};
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<NotificationsApi>('NotificationsApi', ['list', 'unreadCount', 'markRead', 'markAllRead']);
    api.list.and.returnValue(
      of({items: [notification('n1', null, '/discrepancies/x1'), notification('n2', '2026-10-08T10:00:00Z')], unreadCount: 1, page: 0, size: 20, total: 2}),
    );
    api.markRead.and.returnValue(of(undefined));
    api.markAllRead.and.returnValue(of(undefined));
  });

  it('muestra la bandeja con las no leídas resaltadas', () => {
    const {element} = create();
    expect(element.querySelectorAll('.inbox li').length).toBe(2);
    expect(element.querySelectorAll('.inbox li.unread').length).toBe(1);
    expect(element.textContent).toContain('No leídas (1)');
  });

  it('al abrir una no leída la marca y navega a su enlace', () => {
    const {fixture, element} = create();
    (element.querySelector('[data-notification="n1"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.markRead).toHaveBeenCalledWith('n1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/discrepancies/x1');
    expect(element.querySelectorAll('.inbox li.unread').length).toBe(0);
    expect(TestBed.inject(UnreadNotificationsService).count()).toBe(0);
  });

  it('marca todas como leídas', () => {
    const {fixture, element} = create();
    (element.querySelector('button.mark-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.markAllRead).toHaveBeenCalled();
    expect(element.querySelectorAll('.inbox li.unread').length).toBe(0);
  });

  it('filtra solo las no leídas', () => {
    const {element} = create();
    (Array.from(element.querySelectorAll('button.chip')) as HTMLButtonElement[])[1].click();
    expect(api.list).toHaveBeenCalledWith({unreadOnly: true, page: 0, size: 20});
  });
});

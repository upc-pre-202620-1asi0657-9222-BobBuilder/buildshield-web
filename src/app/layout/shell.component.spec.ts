import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {fakeSubscription} from '../../testing/test-helpers';
import {LogisticsApi} from '../core/api/logistics-api';
import {NotificationsApi} from '../core/api/notifications-api';
import {SubscriptionApiService} from '../core/api/subscription-api.service';
import {AuthService} from '../core/auth/auth.service';
import {Role} from '../core/models/role';
import {Subscription} from '../core/models/subscription';
import {ShellComponent} from './shell.component';

describe('ShellComponent (navegación y estado de la cuenta, Sprint 4)', () => {
  function render(role: Role, sub: Subscription) {
    const api = jasmine.createSpyObj<SubscriptionApiService>('SubscriptionApiService', ['current']);
    api.current.and.returnValue(of(sub));
    const notifications = jasmine.createSpyObj<NotificationsApi>('NotificationsApi', ['unreadCount']);
    notifications.unreadCount.and.returnValue(of(0));
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        {provide: SubscriptionApiService, useValue: api},
        {provide: NotificationsApi, useValue: notifications},
        {provide: LogisticsApi, useValue: {simulated: false}},
        {provide: AuthService, useValue: {role: signal(role)}},
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {fixture, element};
  }

  function navLabels(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('#main-nav a')).map((a) => a.textContent?.trim() ?? '');
  }

  it('cada rol ve sus secciones nuevas del Sprint 4', () => {
    const admin = navLabels(render('ADMINISTRATOR', fakeSubscription()).element);
    expect(admin).toEqual(jasmine.arrayContaining(['Devoluciones', 'Inventario', 'Reportes', 'Suscripción']));
    TestBed.resetTestingModule();
    const site = navLabels(render('SITE_MANAGER', fakeSubscription()).element);
    expect(site).toEqual(jasmine.arrayContaining(['Devoluciones', 'Reportes']));
    expect(site).not.toContain('Inventario');
    expect(site).not.toContain('Suscripción');
    TestBed.resetTestingModule();
    const warehouse = navLabels(render('WAREHOUSE_MANAGER', fakeSubscription()).element);
    expect(warehouse).toEqual(jasmine.arrayContaining(['Devoluciones', 'Inventario', 'Reportes']));
    expect(warehouse).not.toContain('Suscripción');
  });

  it('muestra los días de prueba en la navegación sin aviso si quedan más de 3 (US06)', () => {
    const {element} = render('ADMINISTRATOR', fakeSubscription({daysRemaining: 10}));
    const chip = element.querySelector('[data-testid="trial-indicator"]');
    expect(chip?.textContent).toContain('Quedan 10 días');
    expect(chip?.classList).not.toContain('plan-chip-warn');
    expect(element.querySelector('[data-testid="trial-warning"]')).toBeNull();
  });

  it('avisa cuando faltan 3 días o menos (US06)', () => {
    const {element} = render('ADMINISTRATOR', fakeSubscription({daysRemaining: 3}));
    expect(element.querySelector('[data-testid="trial-indicator"]')?.classList).toContain('plan-chip-warn');
    const warning = element.querySelector('[data-testid="trial-warning"]');
    expect(warning?.textContent).toContain('quedan 3 días');
    expect(warning?.querySelector('a')?.getAttribute('href')).toBe('/suscripcion/planes');
  });

  it('con la cuenta vencida muestra el aviso de solo lectura con acceso a pagar (US10)', () => {
    const {element} = render('ADMINISTRATOR', fakeSubscription({status: 'EXPIRED', readOnly: true, daysRemaining: 0}));
    const banner = element.querySelector('[data-testid="read-only-banner"]');
    expect(banner?.textContent).toContain('Cuenta en solo lectura');
    expect(banner?.querySelector('a')?.getAttribute('href')).toBe('/suscripcion/planes');
  });

  it('a los encargados les pide avisar al administrador, sin enlace de pago (US10)', () => {
    const {element} = render('SITE_MANAGER', fakeSubscription({status: 'EXPIRED', readOnly: true, daysRemaining: 0}));
    const banner = element.querySelector('[data-testid="read-only-banner"]');
    expect(banner?.textContent).toContain('Pide al administrador');
    expect(banner?.querySelector('a')).toBeNull();
  });
});

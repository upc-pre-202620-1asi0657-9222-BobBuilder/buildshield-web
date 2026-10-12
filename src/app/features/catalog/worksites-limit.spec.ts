import {HttpErrorResponse} from '@angular/common/http';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {WorksitesPageComponent} from './worksites-page.component';

describe('WorksitesPageComponent: límite del plan Plus (T71)', () => {
  function submitWith(error: string, status: number) {
    const api = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', ['listWorksites', 'createWorksite']);
    api.listWorksites.and.returnValue(of([]));
    api.createWorksite.and.returnValue(
      throwError(() => toApiError(new HttpErrorResponse({status, error: {code: error}}))),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: OrganizationApiService, useValue: api},
        {provide: AuthService, useValue: {role: signal('ADMINISTRATOR')}},
      ],
    });
    const fixture = TestBed.createComponent(WorksitesPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [['#name', 'Obra 6'], ['#address', 'Av. 6'], ['#district', 'Surco']]) {
      const input = element.querySelector(id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(api.createWorksite).toHaveBeenCalled();
    return element;
  }

  it('ante 409 WORKSITE_LIMIT_REACHED invita a pasar al plan Pro', () => {
    const element = submitWith('WORKSITE_LIMIT_REACHED', 409);
    const alert = element.querySelector('[data-testid="worksite-limit"]');
    expect(alert?.textContent).toContain('hasta 5 obras activas');
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/suscripcion/planes');
  });

  it('ante 402 de solo lectura muestra el motivo y no falla en silencio (US10)', () => {
    const element = submitWith('SUBSCRIPTION_READ_ONLY', 402);
    expect(element.querySelector('[data-testid="worksite-limit"]')).toBeNull();
    expect(element.querySelector('.alert-error')?.textContent).toContain('solo lectura');
  });
});

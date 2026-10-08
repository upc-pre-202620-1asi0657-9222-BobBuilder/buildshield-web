import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {Dispatch} from '../../core/models/logistics';
import {TrackingPageComponent} from './tracking-page.component';

function inTransit(id: string, minutesAgo: number, incidentCount = 0): Dispatch {
  return {
    id,
    orderId: 'o1',
    warehouseId: 'a1',
    worksiteId: 'w1',
    type: 'COMPLETE',
    status: 'IN_TRANSIT',
    manifestCode: `MAN-${id}`,
    preparedAt: new Date(Date.now() - 600 * 60_000).toISOString(),
    departedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    receivedAt: null,
    carrier: null,
    departureWeighing: null,
    lines: [],
    incidentCount,
  };
}

describe('TrackingPageComponent (US31)', () => {
  it('lista los despachos en tránsito, el más antiguo primero, con tiempo en ruta, obra e incidencias', () => {
    const api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['listDispatches']);
    api.listDispatches.and.returnValue(of([inTransit('b', 30), inTransit('a', 150, 2)]));
    TestBed.configureTestingModule({
      imports: [TrackingPageComponent],
      providers: [
        provideRouter([]),
        {provide: LogisticsApi, useValue: api},
        {
          provide: OrganizationApiService,
          useValue: {listWorksites: () => of([{id: 'w1', name: 'Torre Norte'}])},
        },
      ],
    });
    const fixture = TestBed.createComponent(TrackingPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(api.listDispatches).toHaveBeenCalledWith({status: 'IN_TRANSIT'});
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('data-dispatch')).toBe('a');
    expect(rows[0].querySelector('.elapsed')?.textContent).toContain('2 h 30 min');
    expect(rows[0].querySelector('.incidents')?.textContent?.trim()).toBe('2');
    expect(rows[0].textContent).toContain('Torre Norte');
    expect(rows[1].querySelector('.elapsed')?.textContent).toContain('30 min');
    fixture.destroy();
  });

  it('muestra un estado vacío cuando no hay nada en ruta', () => {
    TestBed.configureTestingModule({
      imports: [TrackingPageComponent],
      providers: [
        provideRouter([]),
        {provide: LogisticsApi, useValue: {listDispatches: () => of([])}},
        {provide: OrganizationApiService, useValue: {listWorksites: () => of([])}},
      ],
    });
    const fixture = TestBed.createComponent(TrackingPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nada en ruta');
    fixture.destroy();
  });
});

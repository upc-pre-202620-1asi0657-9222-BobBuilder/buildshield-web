import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {Discrepancy} from '../../core/models/discrepancy';
import {Role} from '../../core/models/role';
import {discrepancyActionsFor, evidenceProblem, nextStepHint} from './discrepancy-actions';
import {DiscrepancyDetailPageComponent} from './discrepancy-detail-page.component';
import {DiscrepancyListPageComponent} from './discrepancy-list-page.component';

function discrepancy(overrides: Partial<Discrepancy> = {}): Discrepancy {
  return {
    id: 'x1',
    organizationId: 'org',
    receptionId: 'r1',
    dispatchId: 'd1',
    manifestCode: 'MAN-1',
    worksiteId: 'w1',
    warehouseId: 'a1',
    materialId: 'm1',
    sku: 'CEM-001',
    materialName: 'Cemento',
    type: 'SHORTAGE',
    quantity: 10,
    shrinkagePercent: 5,
    tolerancePercent: 2.5,
    observation: null,
    status: 'OPEN',
    openedBy: 'Obra',
    openedAt: '2026-10-08T12:00:00Z',
    evidences: [],
    ...overrides,
  };
}

describe('discrepancyActionsFor', () => {
  it('el almacén y el administrador responden solo las abiertas', () => {
    expect(discrepancyActionsFor('WAREHOUSE_MANAGER', 'OPEN').respond).toBeTrue();
    expect(discrepancyActionsFor('ADMINISTRATOR', 'OPEN').respond).toBeTrue();
    expect(discrepancyActionsFor('SITE_MANAGER', 'OPEN').respond).toBeFalse();
    expect(discrepancyActionsFor('WAREHOUSE_MANAGER', 'RESPONDED').respond).toBeFalse();
  });

  it('la obra acepta o escala solo las respondidas y sube fotos mientras estén abiertas', () => {
    const site = discrepancyActionsFor('SITE_MANAGER', 'RESPONDED');
    expect(site.accept && site.escalate && site.upload).toBeTrue();
    expect(discrepancyActionsFor('WAREHOUSE_MANAGER', 'RESPONDED').accept).toBeFalse();
    expect(discrepancyActionsFor('SITE_MANAGER', 'ACCEPTED').upload).toBeFalse();
  });

  it('solo el administrador resuelve las escaladas', () => {
    expect(discrepancyActionsFor('ADMINISTRATOR', 'ESCALATED').resolve).toBeTrue();
    expect(discrepancyActionsFor('WAREHOUSE_MANAGER', 'ESCALATED').resolve).toBeFalse();
    expect(discrepancyActionsFor(null, 'ESCALATED').resolve).toBeFalse();
  });

  it('indica quién sigue', () => {
    expect(nextStepHint('OPEN')).toContain('almacén');
    expect(nextStepHint('ESCALATED')).toContain('administrador');
  });

  it('valida tipo y tamaño de la foto', () => {
    expect(evidenceProblem({type: 'image/png', size: 1000})).toBeNull();
    expect(evidenceProblem({type: 'application/pdf', size: 1000})).toContain('JPG');
    expect(evidenceProblem({type: 'image/jpeg', size: 6 * 1024 * 1024})).toContain('5 MB');
  });
});

describe('DiscrepancyListPageComponent', () => {
  it('lista y filtra por estado', () => {
    const api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['listDiscrepancies']);
    api.listDiscrepancies.and.returnValue(of([discrepancy()]));
    TestBed.configureTestingModule({
      imports: [DiscrepancyListPageComponent],
      providers: [
        provideRouter([]),
        {provide: LogisticsApi, useValue: api},
        {provide: OrganizationApiService, useValue: {listWorksites: () => of([{id: 'w1', name: 'Torre Norte'}])}},
      ],
    });
    const fixture = TestBed.createComponent(DiscrepancyListPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.textContent).toContain('Faltante');
    expect(element.textContent).toContain('Torre Norte');
    const chips = Array.from(element.querySelectorAll('button.chip')) as HTMLButtonElement[];
    chips.find((c) => c.textContent?.includes('Escalada'))!.click();
    expect(api.listDiscrepancies).toHaveBeenCalledWith({status: 'ESCALATED', dispatchId: undefined});
  });
});

describe('DiscrepancyDetailPageComponent', () => {
  let api: jasmine.SpyObj<LogisticsApi>;
  let fixture: ComponentFixture<DiscrepancyDetailPageComponent>;
  let element: HTMLElement;

  function create(role: Role, current: Discrepancy): void {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', [
      'getDiscrepancy',
      'respondDiscrepancy',
      'acceptDiscrepancy',
      'escalateDiscrepancy',
      'resolveDiscrepancy',
      'uploadEvidence',
    ]);
    api.getDiscrepancy.and.returnValue(of(current));
    TestBed.configureTestingModule({
      imports: [DiscrepancyDetailPageComponent],
      providers: [
        provideRouter([]),
        {provide: LogisticsApi, useValue: api},
        {provide: AuthService, useValue: {role: () => role}},
      ],
    });
    fixture = TestBed.createComponent(DiscrepancyDetailPageComponent);
    fixture.componentRef.setInput('id', 'x1');
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  it('el almacén responde una discrepancia abierta', async () => {
    create('WAREHOUSE_MANAGER', discrepancy());
    api.respondDiscrepancy.and.returnValue(
      of(discrepancy({status: 'RESPONDED', response: {text: 'Se repone', by: 'Almacén', at: '2026-10-08T13:00:00Z'}})),
    );
    await fixture.whenStable();
    const field = element.querySelector('#responseText') as HTMLTextAreaElement;
    field.value = 'Se repone';
    field.dispatchEvent(new Event('input'));
    (element.querySelector('button.respond') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.respondDiscrepancy).toHaveBeenCalledWith('x1', 'Se repone', jasmine.any(String));
    expect(element.textContent).toContain('Respuesta del almacén');
    expect(element.querySelector('button.respond')).toBeNull();
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });

  it('la obra acepta la respuesta y puede subir fotos', () => {
    create('SITE_MANAGER', discrepancy({status: 'RESPONDED'}));
    api.acceptDiscrepancy.and.returnValue(of(discrepancy({status: 'ACCEPTED'})));
    expect(element.querySelector('input[type="file"]')).not.toBeNull();
    (element.querySelector('button.accept') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.acceptDiscrepancy).toHaveBeenCalled();
    expect(element.textContent).toContain('Cerrada: la obra aceptó');
  });

  it('el administrador resuelve una escalada; el almacén solo ve quién sigue', () => {
    create('WAREHOUSE_MANAGER', discrepancy({status: 'ESCALATED'}));
    expect(element.querySelector('button.resolve')).toBeNull();
    expect(element.textContent).toContain('decisión final del administrador');
  });

  it('sube una foto válida y la agrega a las evidencias', () => {
    create('SITE_MANAGER', discrepancy());
    api.uploadEvidence.and.returnValue(
      of({id: 'e1', url: 'data:image/png;base64,AA==', fileName: 'foto.png', uploadedBy: 'Obra', uploadedAt: '2026-10-08T13:00:00Z'}),
    );
    const input = element.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'foto.png', {type: 'image/png'});
    Object.defineProperty(input, 'files', {value: [file]});
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.uploadEvidence).toHaveBeenCalledWith('x1', file);
    expect(element.querySelectorAll('.photos li').length).toBe(1);
  });
});

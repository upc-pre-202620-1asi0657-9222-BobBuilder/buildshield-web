import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {TEST_ENV} from '../../../testing/test-helpers';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {
  RecipientSettingsApiService,
  WorksiteRecipientSettings,
} from '../../core/api/recipient-settings-api.service';
import {ReportsApiService, fileNameFrom} from '../../core/api/reports-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {APP_ENV} from '../../core/config/app-env';
import {ReconciliationReport} from '../../core/models/report';
import {FileSaver} from '../../core/util/file-saver';
import {RecipientSettingsPageComponent} from '../notifications/recipient-settings-page.component';
import {ReconciliationReportPageComponent} from './reconciliation-report-page.component';

const REPORT: ReconciliationReport = {
  filters: {worksiteId: null, worksiteName: null, warehouseId: null, warehouseName: null, from: null, to: null},
  generatedAt: '2026-10-11T20:00:00Z',
  generatedBy: 'Ana Admin',
  rows: [
    {
      worksiteId: 'ws1',
      worksiteName: 'Torre Norte',
      warehouseId: 'w1',
      warehouseName: 'Almacén Central',
      materialId: 'm1',
      sku: 'CEM-001',
      materialName: 'Cemento',
      unit: 'BAG',
      dispatchCount: 2,
      dispatched: 100,
      received: 94,
      pendingReception: 0,
      confirmedDispatched: 100,
      shrinkage: 6,
      shrinkagePercent: 6,
      tolerancePercent: 2,
      toleranceStatus: 'EXCEEDED',
      linesOutOfTolerance: 1,
      openDiscrepancies: 1,
    },
  ],
  totalsByUnit: [{unit: 'BAG', dispatched: 100, received: 94, pendingReception: 0, shrinkage: 6, shrinkagePercent: 6}],
  summary: {dispatchCount: 2, pendingReceptions: 0, materialRows: 1, rowsExceedingTolerance: 1, linesOutOfTolerance: 1, openDiscrepancies: 1},
  pendingCases: [
    {
      type: 'OPEN_DISCREPANCY',
      dispatchId: 'd1',
      manifestCode: 'MAN-1',
      discrepancyId: 'x1',
      worksiteName: 'Torre Norte',
      warehouseName: 'Almacén Central',
      material: 'Cemento',
      status: 'OPEN',
      since: '2026-10-10T10:00:00Z',
      detail: 'Faltante 6',
    },
  ],
};

describe('Reporte de conciliación (US47 y US48)', () => {
  it('lee el nombre del archivo de Content-Disposition', () => {
    expect(fileNameFrom('attachment; filename="conciliacion-20261011-2000.csv"', 'x.csv')).toBe('conciliacion-20261011-2000.csv');
    expect(fileNameFrom("attachment; filename*=UTF-8''conciliaci%C3%B3n.pdf", 'x.pdf')).toBe('conciliación.pdf');
    expect(fileNameFrom(null, 'conciliacion.csv')).toBe('conciliacion.csv');
  });

  it('pide el reporte y la exportación con los filtros por la API', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), {provide: APP_ENV, useValue: TEST_ENV}],
    });
    const api = TestBed.inject(ReportsApiService);
    const http = TestBed.inject(HttpTestingController);
    api.reconciliation({worksiteId: 'ws1', from: '2026-10-01'}).subscribe();
    const get = http.expectOne((r) => r.url === '/api/v1/audit/reports/reconciliation');
    expect(get.request.params.get('worksiteId')).toBe('ws1');
    expect(get.request.params.get('from')).toBe('2026-10-01');
    expect(get.request.params.has('to')).toBeFalse();
    get.flush(REPORT);

    let name = '';
    api.export({warehouseId: 'w1'}, 'pdf').subscribe((file) => (name = file.fileName));
    const exp = http.expectOne((r) => r.url === '/api/v1/audit/reports/reconciliation/export');
    expect(exp.request.params.get('format')).toBe('pdf');
    expect(exp.request.params.get('warehouseId')).toBe('w1');
    expect(exp.request.responseType).toBe('blob');
    exp.flush(new Blob(['%PDF']), {headers: {'Content-Disposition': 'attachment; filename="conciliacion-1.pdf"'}});
    expect(name).toBe('conciliacion-1.pdf');
    http.verify();
  });

  it('muestra filas, totales y casos pendientes, y descarga el CSV con los mismos filtros', () => {
    const reports = jasmine.createSpyObj<ReportsApiService>('ReportsApiService', ['reconciliation', 'export']);
    reports.reconciliation.and.returnValue(of(REPORT));
    reports.export.and.returnValue(of({fileName: 'conciliacion-1.csv', blob: new Blob(['a;b'])}));
    const saver = jasmine.createSpyObj<FileSaver>('FileSaver', ['save']);
    const organization = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', ['listWorksites', 'listWarehouses']);
    organization.listWorksites.and.returnValue(of([]));
    organization.listWarehouses.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: ReportsApiService, useValue: reports},
        {provide: OrganizationApiService, useValue: organization},
        {provide: FileSaver, useValue: saver},
        {provide: AuthService, useValue: {role: signal('SITE_MANAGER')}},
      ],
    });
    const fixture = TestBed.createComponent(ReconciliationReportPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('despachado a tus obras');
    expect(element.querySelector('[data-testid="report-rows"] tr.exceeded')?.textContent).toContain('Supera la tolerancia');
    expect(element.querySelector('[data-testid="report-totals"]')?.textContent).toContain('BAG');
    expect(element.querySelector('[data-testid="pending-cases"]')?.textContent).toContain('Discrepancia abierta');

    const from = element.querySelector('#rep-from') as HTMLInputElement;
    from.value = '2026-10-01';
    from.dispatchEvent(new Event('input'));
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(reports.reconciliation).toHaveBeenCalledWith({worksiteId: undefined, warehouseId: undefined, from: '2026-10-01', to: undefined});
    fixture.detectChanges();
    (element.querySelector('[data-testid="export-csv"]') as HTMLButtonElement).click();
    expect(reports.export).toHaveBeenCalledWith(jasmine.objectContaining({from: '2026-10-01'}), 'csv');
    expect(saver.save).toHaveBeenCalledWith(jasmine.any(Blob), 'conciliacion-1.csv');
  });

  it('no consulta con un periodo invertido', () => {
    const reports = jasmine.createSpyObj<ReportsApiService>('ReportsApiService', ['reconciliation', 'export']);
    reports.reconciliation.and.returnValue(of(REPORT));
    const organization = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', ['listWorksites', 'listWarehouses']);
    organization.listWorksites.and.returnValue(of([]));
    organization.listWarehouses.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: ReportsApiService, useValue: reports},
        {provide: OrganizationApiService, useValue: organization},
        {provide: AuthService, useValue: {role: signal('ADMINISTRATOR')}},
      ],
    });
    const fixture = TestBed.createComponent(ReconciliationReportPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [['#rep-from', '2026-10-10'], ['#rep-to', '2026-10-01']]) {
      const input = element.querySelector(id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(reports.reconciliation).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('no puede ser posterior');
  });
});

describe('Destinatarios por obra y tipo de aviso (US45)', () => {
  const SETTINGS: WorksiteRecipientSettings = {
    worksiteId: 'ws1',
    worksiteName: 'Torre Norte',
    types: [
      {
        type: 'DISPATCH_IN_TRANSIT',
        label: 'Despacho en camino',
        configured: false,
        defaultAudience: 'Encargados de obra asignados a la obra',
        recipients: [],
        updatedBy: null,
        updatedAt: null,
      },
      {
        type: 'DISCREPANCY_ESCALATED',
        label: 'Discrepancia escalada',
        configured: true,
        defaultAudience: 'Administradores',
        recipients: [{userId: 'u2', fullName: 'Bea Obra', email: 'bea@x.pe', role: 'SITE_MANAGER', active: true}],
        updatedBy: 'u1',
        updatedAt: '2026-10-11T10:00:00Z',
      },
    ],
    candidates: [
      {userId: 'u1', fullName: 'Ana Admin', email: 'ana@x.pe', role: 'ADMINISTRATOR', active: true},
      {userId: 'u2', fullName: 'Bea Obra', email: 'bea@x.pe', role: 'SITE_MANAGER', active: true},
    ],
  };

  it('elige destinatarios, guarda y vuelve a lo predeterminado', () => {
    const api = jasmine.createSpyObj<RecipientSettingsApiService>('RecipientSettingsApiService', ['forWorksite', 'replace', 'reset']);
    api.forWorksite.and.returnValue(of(SETTINGS));
    api.replace.and.callFake((_w, type, userIds) =>
      of({...SETTINGS.types[0], type, configured: true, recipients: SETTINGS.candidates.filter((c) => userIds.includes(c.userId))}),
    );
    api.reset.and.returnValue(of(undefined));
    const organization = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', ['listWorksites']);
    organization.listWorksites.and.returnValue(
      of([{id: 'ws1', name: 'Torre Norte', address: '', district: '', city: '', latitude: null, longitude: null, startDate: '2026-01-01', endDate: null}]),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: RecipientSettingsApiService, useValue: api},
        {provide: OrganizationApiService, useValue: organization},
      ],
    });
    const fixture = TestBed.createComponent(RecipientSettingsPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('#rs-worksite') as HTMLSelectElement;
    select.value = 'ws1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.forWorksite).toHaveBeenCalledWith('ws1');

    const transit = element.querySelector('[data-type="DISPATCH_IN_TRANSIT"]') as HTMLElement;
    expect(transit.textContent).toContain('Por defecto: Encargados de obra');
    const boxes = transit.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes[1].checked).toBeFalse();
    boxes[1].click();
    fixture.detectChanges();
    (transit.querySelector('.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.replace).toHaveBeenCalledWith('ws1', 'DISPATCH_IN_TRANSIT', ['u2']);
    expect(element.textContent).toContain('1 destinatario(s) guardados');

    const escalated = element.querySelector('[data-type="DISCREPANCY_ESCALATED"]') as HTMLElement;
    expect(escalated.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].checked).toBeTrue();
    (Array.from(escalated.querySelectorAll('button')).find((b) => b.textContent?.includes('predeterminado')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.reset).toHaveBeenCalledWith('ws1', 'DISCREPANCY_ESCALATED');
    expect(element.textContent).toContain('vuelve a llegar a administradores');
  });
});

import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ReceptionComparisonComponent} from './reception-comparison.component';
import {ReceivedChange, ReceptionLineView} from './reception-models';

function row(overrides: Partial<ReceptionLineView>): ReceptionLineView {
  return {
    lineId: 'l1',
    materialId: 'm1',
    sku: 'CEM-001',
    materialName: 'Cemento Portland tipo I',
    unit: 'BAG',
    requested: 200,
    dispatched: 200,
    received: 200,
    difference: 0,
    shrinkagePercent: 0,
    withinTolerance: true,
    tolerancePercent: 2.5,
    saveState: 'saved',
    ...overrides,
  };
}

describe('ReceptionComparisonComponent', () => {
  let fixture: ComponentFixture<ReceptionComparisonComponent>;
  let element: HTMLElement;
  let emitted: ReceivedChange[];

  function render(rows: ReceptionLineView[], locked = false): void {
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('locked', locked);
    fixture.detectChanges();
  }

  function rowElement(lineId: string): HTMLElement {
    return element.querySelector(`[data-line="${lineId}"]`) as HTMLElement;
  }

  function cell(lineId: string, label: string): string {
    return (
      rowElement(lineId).querySelector(`[data-label="${label}"]`)?.textContent?.trim() ?? ''
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [ReceptionComparisonComponent]});
    fixture = TestBed.createComponent(ReceptionComparisonComponent);
    element = fixture.nativeElement as HTMLElement;
    emitted = [];
    fixture.componentInstance.receivedChange.subscribe((c) => emitted.push(c));
  });

  it('muestra una fila por material con solicitado, despachado, recibido y merma', () => {
    render([
      row({}),
      row({
        lineId: 'l2',
        materialId: 'm2',
        sku: 'FIE-012',
        requested: 180,
        dispatched: 150,
        received: 140,
        difference: 10,
        shrinkagePercent: 6.67,
        withinTolerance: false,
      }),
    ]);

    expect(element.querySelectorAll('.line').length).toBe(2);
    expect(cell('l2', 'Solicitado')).toBe('180');
    expect(cell('l2', 'Despachado')).toBe('150');
    expect((rowElement('l2').querySelector('input') as HTMLInputElement).value).toBe('140');
    expect(cell('l2', 'Diferencia')).toBe('10');
    expect(cell('l2', 'Merma')).toContain('6.67');
  });

  it('marca cada material dentro, fuera o por evaluar respecto a la tolerancia', () => {
    render([
      row({lineId: 'ok', withinTolerance: true}),
      row({lineId: 'bad', withinTolerance: false}),
      row({lineId: 'unknown', withinTolerance: null}),
    ]);

    expect(rowElement('ok').querySelector('.tolerance')?.classList).toContain('badge-ok');
    expect(cell('ok', 'Tolerancia')).toBe('Dentro de tolerancia');
    expect(rowElement('bad').querySelector('.tolerance')?.classList).toContain('badge-bad');
    expect(cell('bad', 'Tolerancia')).toBe('Fuera de tolerancia');
    expect(cell('unknown', 'Tolerancia')).toBe('Por evaluar');
    expect(element.querySelector('.summary')?.textContent).toContain('1 fuera de tolerancia');
  });

  it('muestra el estado de guardado de cada línea', () => {
    render([
      row({lineId: 'a', saveState: 'saved'}),
      row({lineId: 'b', saveState: 'pending'}),
      row({lineId: 'c', saveState: 'retrying'}),
      row({lineId: 'd', saveState: 'error'}),
    ]);

    expect(cell('a', 'Estado')).toBe('Guardado');
    expect(cell('b', 'Estado')).toBe('Pendiente');
    expect(cell('c', 'Estado')).toBe('Reintentando…');
    expect(cell('d', 'Estado')).toContain('No se guardó');
  });

  it('emite la cantidad recibida al cambiar el campo', () => {
    render([row({})]);
    const input = rowElement('l1').querySelector('input') as HTMLInputElement;
    input.value = '195.5';
    input.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{lineId: 'l1', receivedQty: 195.5}]);
  });

  it('ignora valores vacíos o negativos y el mismo valor ya guardado', () => {
    render([row({})]);
    const input = rowElement('l1').querySelector('input') as HTMLInputElement;
    for (const value of ['', '-3', '200']) {
      input.value = value;
      input.dispatchEvent(new Event('change'));
    }
    expect(emitted).toEqual([]);
  });

  it('permite reintentar una línea que no se guardó', () => {
    render([row({saveState: 'error', received: 190})]);
    (rowElement('l1').querySelector('button.retry') as HTMLButtonElement).click();
    expect(emitted).toEqual([{lineId: 'l1', receivedQty: 190}]);
  });

  it('bloquea la edición cuando la recepción está confirmada', () => {
    render([row({saveState: 'error'})], true);
    expect((rowElement('l1').querySelector('input') as HTMLInputElement).disabled).toBeTrue();
    expect(rowElement('l1').querySelector('button.retry')).toBeNull();
  });

  it('el campo de cantidad tiene al menos 48 px de alto (RNF21)', () => {
    render([row({})]);
    const input = rowElement('l1').querySelector('input') as HTMLInputElement;
    expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });
});

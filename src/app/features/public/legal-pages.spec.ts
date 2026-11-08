import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Meta} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';

import {PRIVACY_DESCRIPTION, PrivacyPageComponent} from './privacy-page.component';
import {LEGAL_CONTACT_EMAIL} from './public-content';
import {TERMS_DESCRIPTION, TermsPageComponent} from './terms-page.component';

function render<T>(component: Type<T>) {
  TestBed.configureTestingModule({imports: [component], providers: [provideRouter([])]});
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return {fixture, element, text: element.textContent?.replace(/\s+/g, ' ') ?? ''};
}

describe('TermsPageComponent (US50)', () => {
  it('tiene landmarks, un h1, índice que apunta a cada sección y la meta descripción', () => {
    const {element, fixture} = render(TermsPageComponent);

    expect(element.querySelector('main#contenido article')).not.toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    const tocLinks = Array.from(element.querySelectorAll('nav.toc a'));
    expect(tocLinks.length).toBe(12);
    for (const link of tocLinks) {
      const id = link.getAttribute('href')!.split('#')[1];
      expect(element.querySelector(`section#${id}`)).withContext(id).not.toBeNull();
    }
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(TERMS_DESCRIPTION);
    fixture.destroy();
  });

  it('describe la suscripción por obras activas, la prueba, Stripe y la solo lectura', () => {
    const {text, fixture} = render(TermsPageComponent);

    expect(text).toContain('prueba gratuita de 14 días');
    expect(text).toContain('Plus: hasta 5 obras activas');
    expect(text).toContain('Pro: obras activas ilimitadas');
    expect(text).toContain('por mes o por año');
    expect(text).toContain('Stripe');
    expect(text).toContain('BuildShield no los recibe ni los guarda');
    expect(text).toContain('pasa a solo lectura');
    expect(text).toContain('Ley N.º 29733');
    expect(text).toContain('No incluye seguimiento por GPS');
    expect(text).not.toMatch(/[—–]/);
    fixture.destroy();
  });
});

describe('PrivacyPageComponent (US50)', () => {
  it('se basa en la Ley N.º 29733 y su Reglamento y enlaza a los términos', () => {
    const {element, text, fixture} = render(PrivacyPageComponent);

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(text).toContain('Ley N.º 29733, Ley de Protección de Datos Personales');
    expect(text).toContain('Reglamento');
    expect(text).toContain('Autoridad Nacional de Protección de Datos Personales');
    expect(element.querySelector('a[href="/terminos"]')).not.toBeNull();
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(PRIVACY_DESCRIPTION);
    fixture.destroy();
  });

  it('explica los derechos ARCO con su canal, los encargados y que no se guardan tarjetas', () => {
    const {element, text, fixture} = render(PrivacyPageComponent);

    for (const right of ['acceso', 'rectificación', 'cancelación', 'oposición']) {
      expect(text).toContain(right);
    }
    expect(element.querySelector(`a[href="mailto:${LEGAL_CONTACT_EMAIL}"]`)).not.toBeNull();
    expect(text).toContain('Stripe');
    expect(text).toContain('SendGrid');
    expect(text).toContain('BuildShield no los recibe ni los guarda');
    expect(text).toContain('no recoge la ubicación');
    expect(text).not.toMatch(/[—–]/);
    fixture.destroy();
  });
});

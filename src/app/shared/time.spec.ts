import {elapsedSince} from './time';

describe('elapsedSince', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it('devuelve un guion sin fecha o con fecha inválida', () => {
    expect(elapsedSince(null, now)).toBe('-');
    expect(elapsedSince('no es fecha', now)).toBe('-');
  });

  it('expresa minutos, horas y días', () => {
    expect(elapsedSince(ago(0), now)).toBe('menos de 1 min');
    expect(elapsedSince(ago(45), now)).toBe('45 min');
    expect(elapsedSince(ago(120), now)).toBe('2 h');
    expect(elapsedSince(ago(190), now)).toBe('3 h 10 min');
    expect(elapsedSince(ago(52 * 60), now)).toBe('2 d 4 h');
    expect(elapsedSince(ago(48 * 60), now)).toBe('2 d');
  });

  it('no devuelve tiempos negativos si el reloj del cliente va atrasado', () => {
    expect(elapsedSince(new Date(now + 60_000).toISOString(), now)).toBe('menos de 1 min');
  });
});

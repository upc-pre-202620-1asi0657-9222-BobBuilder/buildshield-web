/** Contenido fijo de la página pública: equipo (US49) y formato de precios. */

export interface TeamMember {
  readonly surnames: string;
  readonly givenNames: string;
}

/** Integrantes de BobBuilder en orden alfabético por apellido. */
export const TEAM: readonly TeamMember[] = [
  {surnames: 'Barba Estrada', givenNames: 'Bryan Eduardo'},
  {surnames: 'Rojas Tello', givenNames: 'Nestor Alonso'},
  {surnames: 'Salazar Caballero', givenNames: 'Alvaro Fabrizzio'},
  {surnames: 'Sandoval Cueto', givenNames: 'Fabian Jesus'},
  {surnames: 'Santiago Peña', givenNames: 'Andreow Jomark'},
  {surnames: 'Taipe Sangama', givenNames: 'Jorge Francisco'},
];

export const TEAM_CAREER = 'Ingeniería de Software, UPC';

/** Iniciales del avatar: primer nombre y primer apellido. Sin fotos. */
export function initialsOf(member: TeamMember): string {
  const first = member.givenNames.trim().charAt(0);
  const last = member.surnames.trim().charAt(0);
  return `${first}${last}`.toLocaleUpperCase('es-PE');
}

export function fullNameOf(member: TeamMember): string {
  return `${member.givenNames} ${member.surnames}`;
}

const NBSP = '\u00a0';
const SYMBOLS: Readonly<Record<string, string>> = {PEN: 'S/', USD: 'US$'};

/**
 * Monto en formato de lectura: `S/ 2 990`, `S/ 1 398,50`. Separa miles con
 * espacio no separable y usa coma decimal solo si hay céntimos.
 */
export function formatMoney(amount: number, currency = 'PEN'): string {
  const symbol = SYMBOLS[currency] ?? currency;
  const cents = Math.round(Math.abs(amount) * 100);
  const integer = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = cents % 100 === 0 ? '' : `,${(cents % 100).toString().padStart(2, '0')}`;
  return `${amount < 0 ? '-' : ''}${symbol}${NBSP}${integer}${decimals}`;
}

/** Porcentaje redondeado al entero: `17 %`. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}${NBSP}%`;
}

/** Correo para consultas legales y derechos ARCO. El equipo debe confirmarlo. */
export const LEGAL_CONTACT_EMAIL = 'privacidad@buildshield.pe';

/** Fecha de la versión vigente de términos y privacidad. */
export const LEGAL_UPDATED_AT = '11 de octubre de 2026';

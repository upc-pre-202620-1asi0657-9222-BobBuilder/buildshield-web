import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

/** Contraseña de 8 a 72 caracteres con al menos una letra y un número (regla del backend). */
export const passwordRule: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  const ok =
    value.length >= 8 && value.length <= 72 && /\p{L}/u.test(value) && /\d/.test(value);
  return ok ? null : {passwordRule: true};
};

/** RUC peruano: exactamente 11 dígitos. */
export const rucRule: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  return /^\d{11}$/.test(value) ? null : {ruc: true};
};

export const PASSWORD_HINT = 'De 8 a 72 caracteres, con al menos una letra y un número.';

/** Fecha local de hoy en formato AAAA-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Tiempo transcurrido en texto corto, por ejemplo «45 min», «3 h 10 min» o
 * «2 d 4 h». Sirve para el seguimiento en ruta y la bandeja de notificaciones.
 */
export function elapsedSince(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '-';
  }
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return '-';
  }
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) {
    return 'menos de 1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}

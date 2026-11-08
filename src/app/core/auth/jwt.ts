/** Claims del JWT de buildshield-core que usa el frontend. */
export interface JwtClaims {
  sub?: string;
  org?: string;
  role?: string;
  exp?: number;
}

/** Decodifica el payload de un JWT sin validar la firma (eso lo hace el backend). */
export function decodeJwt(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length < 2) {
    return {};
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as JwtClaims) : {};
  } catch {
    return {};
  }
}

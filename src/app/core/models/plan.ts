/** Código de plan del catálogo público (subscription-service). */
export type PlanCode = 'FREE' | 'PLUS' | 'PRO';

/** Plan tal como lo publica `GET /api/v1/plans`. Los campos de precio pueden faltar. */
export interface PlanResponse {
  readonly code: string;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly maxActiveWorksites?: number | null;
  readonly unlimitedWorksites?: boolean | null;
  readonly trialOnly?: boolean | null;
  readonly trialDays?: number | null;
  readonly monthlyPrice?: number | string | null;
  readonly annualPrice?: number | string | null;
  readonly annualDiscountPercent?: number | string | null;
  /** Ahorro anual en dinero frente a pagar doce meses. Opcional: si falta se calcula. */
  readonly annualSavings?: number | string | null;
  readonly currency?: string | null;
}

/** Plan listo para mostrarse en la página pública. */
export interface PublicPlan {
  readonly code: PlanCode;
  readonly name: string;
  readonly description: string;
  /** Obras activas permitidas; `null` cuando son ilimitadas. */
  readonly maxActiveWorksites: number | null;
  readonly trialOnly: boolean;
  readonly trialDays: number | null;
  readonly monthlyPrice: number;
  readonly annualPrice: number;
  /** Lo que se ahorra al año pagando el plan anual en vez de doce meses. */
  readonly annualSavings: number;
  readonly annualDiscountPercent: number;
  readonly currency: string;
}

/** Catálogo de planes con su origen, para saber si se usó el respaldo. */
export interface PlanCatalog {
  readonly plans: readonly PublicPlan[];
  readonly source: 'api' | 'fallback';
}

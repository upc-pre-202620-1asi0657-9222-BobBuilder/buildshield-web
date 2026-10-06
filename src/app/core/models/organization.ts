import {Role} from './role';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

export interface Worksite {
  id: string;
  name: string;
  address: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDate: string | null;
}

export interface CreateWorksiteRequest {
  name: string;
  address: string;
  district: string;
  city: string;
  startDate: string;
  endDate?: string | null;
}

export type WarehouseType = 'WAREHOUSE' | 'COLLECTION_CENTER';

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  address: string;
  active: boolean;
}

export interface CreateWarehouseRequest {
  name: string;
  type: WarehouseType;
  address: string;
}

export type UnitOfMeasure =
  | 'UNIT'
  | 'KG'
  | 'TONNE'
  | 'M'
  | 'M2'
  | 'M3'
  | 'LITER'
  | 'BAG'
  | 'BOX'
  | 'ROLL';

export const UNIT_LABELS: Readonly<Record<UnitOfMeasure, string>> = {
  UNIT: 'Unidad',
  KG: 'Kilogramo',
  TONNE: 'Tonelada',
  M: 'Metro',
  M2: 'Metro cuadrado',
  M3: 'Metro cúbico',
  LITER: 'Litro',
  BAG: 'Bolsa',
  BOX: 'Caja',
  ROLL: 'Rollo',
};

export const UNITS = Object.keys(UNIT_LABELS) as UnitOfMeasure[];

export interface Material {
  id: string;
  sku: string;
  name: string;
  unit: UnitOfMeasure;
  wasteTolerancePercent: number;
  active: boolean;
}

export interface CreateMaterialRequest {
  sku: string;
  name: string;
  unit: UnitOfMeasure;
  wasteTolerancePercent: number;
}

export type SiteType = 'WORKSITE' | 'WAREHOUSE';

export interface Assignment {
  id: string;
  userId: string;
  siteType: SiteType;
  siteId: string;
  assignedAt: string;
  endedAt: string | null;
  active: boolean;
}

export interface CreateAssignmentRequest {
  userId: string;
  siteType: SiteType;
  siteId: string;
}

export interface StockLevel {
  warehouseId: string;
  warehouseName: string;
  materialId: string;
  sku: string;
  materialName: string;
  unit: string;
  availableQty: number;
  reservedQty: number;
}

export interface StockEntryRequest {
  warehouseId: string;
  materialId: string;
  quantity: number;
  note?: string;
}

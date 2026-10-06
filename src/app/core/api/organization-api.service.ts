import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {
  Assignment,
  CreateAssignmentRequest,
  CreateMaterialRequest,
  CreateUserRequest,
  CreateWarehouseRequest,
  CreateWorksiteRequest,
  Material,
  StockEntryRequest,
  StockLevel,
  User,
  Warehouse,
  Worksite,
} from '../models/organization';

/** Usuarios, obras, almacenes, materiales, asignaciones y stock (Sprint 1). */
@Injectable({providedIn: 'root'})
export class OrganizationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_ENV).apiBaseUrl;

  listUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`);
  }

  createUser(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.base}/users`, request);
  }

  listWorksites(): Observable<Worksite[]> {
    return this.http.get<Worksite[]>(`${this.base}/worksites`);
  }

  createWorksite(request: CreateWorksiteRequest): Observable<Worksite> {
    return this.http.post<Worksite>(`${this.base}/worksites`, request);
  }

  listWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.base}/warehouses`);
  }

  createWarehouse(request: CreateWarehouseRequest): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${this.base}/warehouses`, request);
  }

  listMaterials(): Observable<Material[]> {
    return this.http.get<Material[]>(`${this.base}/materials`);
  }

  createMaterial(request: CreateMaterialRequest): Observable<Material> {
    return this.http.post<Material>(`${this.base}/materials`, request);
  }

  listAssignments(): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${this.base}/assignments`);
  }

  createAssignment(request: CreateAssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(`${this.base}/assignments`, request);
  }

  listStock(warehouseId?: string): Observable<StockLevel[]> {
    const params = warehouseId ? new HttpParams().set('warehouseId', warehouseId) : undefined;
    return this.http.get<StockLevel[]>(`${this.base}/stock`, {params});
  }

  /** Requiere Idempotency-Key: lo agrega idempotencyInterceptor. */
  registerStockEntry(request: StockEntryRequest): Observable<unknown> {
    return this.http.post(`${this.base}/stock/entries`, request);
  }
}

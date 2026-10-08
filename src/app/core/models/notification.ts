/** Bandeja de notificaciones en la aplicación (Sprint 3, US43). */

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  /** Ruta de la web, por ejemplo /discrepancies/{id}. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: AppNotification[];
  unreadCount: number;
  page: number;
  size: number;
  total: number;
}

export interface NotificationQuery {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

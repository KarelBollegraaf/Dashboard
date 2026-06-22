export type UserRole =
  | "basic"
  | "customer_management"
  | "internal_management";

export type Permission =
  | "*"
  | "dashboard.access"
  | "overview.view"
  | "bales.view"
  | "cycles.view"
  | "pressure.view"
  | "quality.view"
  | "events.view"
  | "raw.view"
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.disable"
  | "users.login.edit"
  | "permissions.edit.basic"
  | "permissions.edit.customer"
  | "settings.view"
  | "settings.edit";

export interface DashboardUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface StoredDashboardUser extends DashboardUser {
  /**
   * Demo-only password storage.
   * Replace this with a backend password hash before production use.
   */
  password: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
}

import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import type { AuthSession, DashboardUser, StoredDashboardUser } from "./types";

export const USERS_STORAGE_KEY = "dashboard.client.users.v4";
export const AUTH_SESSION_STORAGE_KEY = "dashboard.auth.session.v2";

function nowIso() {
  return new Date().toISOString();
}

function createSeedUsers(): StoredDashboardUser[] {
  const createdAt = nowIso();

  return [
    {
      id: "internal-admin-karel",
      email: "k.bruijn@bollegraaf.com",
      name: "Karel Bruijn",
      role: "internal_management",
      permissions: DEFAULT_ROLE_PERMISSIONS.internal_management,
      password: "BRM",
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      lastLoginAt: null,
    },
  ];
}

export function toPublicUser(user: StoredDashboardUser): DashboardUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function loadUsers(): StoredDashboardUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);

    if (!raw) {
      const seedUsers = createSeedUsers();
      saveUsers(seedUsers);
      return seedUsers;
    }

    const users = JSON.parse(raw) as StoredDashboardUser[];
    if (!Array.isArray(users) || users.length === 0) {
      const seedUsers = createSeedUsers();
      saveUsers(seedUsers);
      return seedUsers;
    }

    return users;
  } catch {
    const seedUsers = createSeedUsers();
    saveUsers(seedUsers);
    return seedUsers;
  }
}

export function saveUsers(users: StoredDashboardUser[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

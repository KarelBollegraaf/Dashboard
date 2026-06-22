import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canManageRole,
  DEFAULT_ROLE_PERMISSIONS,
  hasUserPermission,
} from "./permissions";
import {
  clearSession,
  loadSession,
  loadUsers,
  saveSession,
  saveUsers,
  toPublicUser,
} from "./authStorage";
import type {
  DashboardUser,
  Permission,
  StoredDashboardUser,
  UserRole,
} from "./types";

interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions?: Permission[];
  isActive?: boolean;
}

interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  permissions?: Permission[];
  isActive?: boolean;
}

interface AuthContextValue {
  currentUser: DashboardUser | null;
  users: DashboardUser[];
  login: (email: string, password: string) => DashboardUser;
  logout: () => void;
  hasPermission: (permission?: Permission) => boolean;
  createUser: (input: CreateUserInput) => void;
  updateUser: (id: string, input: UpdateUserInput) => void;
  setUserActive: (id: string, isActive: boolean) => void;
  changePasswordFromReset: (email: string, password: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createToken(userId: string) {
  return `client-dashboard-${userId}-${Date.now()}`;
}

function sanitizePermissions(role: UserRole, permissions?: Permission[]) {
  if (role === "internal_management") return DEFAULT_ROLE_PERMISSIONS[role];

  const allowedPermissions = new Set<Permission>([
    "dashboard.access",
    "overview.view",
    "bales.view",
    "cycles.view",
    "pressure.view",
    "quality.view",
    "events.view",
    "raw.view",
    "users.view",
    "users.create",
    "users.edit",
    "users.disable",
    "users.login.edit",
    "permissions.edit.basic",
    "settings.view",
  ]);

  return (permissions || DEFAULT_ROLE_PERMISSIONS[role]).filter((permission) =>
    allowedPermissions.has(permission)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedUsers, setStoredUsers] = useState<StoredDashboardUser[]>(() =>
    loadUsers()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const session = loadSession();
    return session?.userId || null;
  });

  const currentStoredUser =
    storedUsers.find((user) => user.id === currentUserId && user.isActive) ||
    null;

  const currentUser = currentStoredUser ? toPublicUser(currentStoredUser) : null;

  const persistUsers = useCallback((nextUsers: StoredDashboardUser[]) => {
    setStoredUsers(nextUsers);
    saveUsers(nextUsers);
  }, []);

  const login = useCallback(
    (email: string, password: string) => {
      const normalizedEmail = normalizeEmail(email);
      const user = storedUsers.find(
        (storedUser) => normalizeEmail(storedUser.email) === normalizedEmail
      );

      if (!user || !user.isActive || user.password !== password) {
        throw new Error("Invalid email or password.");
      }

      const updatedAt = new Date().toISOString();
      const nextUsers = storedUsers.map((storedUser) =>
        storedUser.id === user.id
          ? { ...storedUser, lastLoginAt: updatedAt, updatedAt }
          : storedUser
      );

      persistUsers(nextUsers);

      const session = {
        token: createToken(user.id),
        userId: user.id,
        createdAt: updatedAt,
      };

      saveSession(session);
      setCurrentUserId(user.id);

      return toPublicUser({ ...user, lastLoginAt: updatedAt, updatedAt });
    },
    [persistUsers, storedUsers]
  );

  const logout = useCallback(() => {
    clearSession();
    setCurrentUserId(null);
  }, []);

  const hasPermission = useCallback(
    (permission?: Permission) => hasUserPermission(currentUser, permission),
    [currentUser]
  );

  const ensureCanManageUser = useCallback(
    (targetRole: UserRole) => {
      if (!currentUser) {
        throw new Error("You are not logged in.");
      }

      if (!canManageRole(currentUser, targetRole)) {
        throw new Error("You are not allowed to manage this account level.");
      }
    },
    [currentUser]
  );

  const createUser = useCallback(
    (input: CreateUserInput) => {
      ensureCanManageUser(input.role);

      if (!hasUserPermission(currentUser, "users.create")) {
        throw new Error("You are not allowed to create users.");
      }

      const email = normalizeEmail(input.email);
      if (!email) throw new Error("Email is required.");
      if (!input.name.trim()) throw new Error("Name is required.");
      if (!input.password.trim()) throw new Error("Password is required.");

      if (storedUsers.some((user) => normalizeEmail(user.email) === email)) {
        throw new Error("A user with this email already exists.");
      }

      const createdAt = new Date().toISOString();

      const user: StoredDashboardUser = {
        id: createId(),
        email,
        name: input.name.trim(),
        password: input.password,
        role: input.role,
        permissions: sanitizePermissions(input.role, input.permissions),
        isActive: input.isActive ?? true,
        createdAt,
        updatedAt: createdAt,
        lastLoginAt: null,
      };

      persistUsers([...storedUsers, user]);
    },
    [currentUser, ensureCanManageUser, persistUsers, storedUsers]
  );

  const updateUser = useCallback(
    (id: string, input: UpdateUserInput) => {
      const targetUser = storedUsers.find((user) => user.id === id);
      if (!targetUser) throw new Error("User not found.");

      const targetRole = input.role || targetUser.role;
      ensureCanManageUser(targetRole);

      if (!hasUserPermission(currentUser, "users.edit")) {
        throw new Error("You are not allowed to edit users.");
      }

      if (
        targetUser.role !== "basic" &&
        currentUser?.role === "customer_management"
      ) {
        throw new Error("Customer managers can only edit basic users.");
      }

      const email = input.email ? normalizeEmail(input.email) : targetUser.email;
      if (!email) throw new Error("Email is required.");

      const duplicateEmail = storedUsers.some(
        (user) => user.id !== id && normalizeEmail(user.email) === email
      );

      if (duplicateEmail) {
        throw new Error("A user with this email already exists.");
      }

      const updatedAt = new Date().toISOString();

      const nextUsers = storedUsers.map((user) => {
        if (user.id !== id) return user;

        return {
          ...user,
          email,
          name: input.name !== undefined ? input.name.trim() : user.name,
          password: input.password ? input.password : user.password,
          role: targetRole,
          permissions: sanitizePermissions(targetRole, input.permissions),
          isActive: input.isActive ?? user.isActive,
          updatedAt,
        };
      });

      persistUsers(nextUsers);
    },
    [currentUser, ensureCanManageUser, persistUsers, storedUsers]
  );

  const setUserActive = useCallback(
    (id: string, isActive: boolean) => {
      const targetUser = storedUsers.find((user) => user.id === id);
      if (!targetUser) throw new Error("User not found.");

      ensureCanManageUser(targetUser.role);

      if (!hasUserPermission(currentUser, "users.disable")) {
        throw new Error("You are not allowed to disable users.");
      }

      if (currentUser?.id === id && !isActive) {
        throw new Error("You cannot disable your own active account.");
      }

      const updatedAt = new Date().toISOString();
      const nextUsers = storedUsers.map((user) =>
        user.id === id ? { ...user, isActive, updatedAt } : user
      );

      persistUsers(nextUsers);
    },
    [currentUser, ensureCanManageUser, persistUsers, storedUsers]
  );


  const changePasswordFromReset = useCallback(
    (email: string, password: string) => {
      const normalizedEmail = normalizeEmail(email);
      const updatedAt = new Date().toISOString();
      let didUpdate = false;

      const nextUsers = storedUsers.map((user) => {
        if (normalizeEmail(user.email) !== normalizedEmail) return user;
        didUpdate = true;
        return { ...user, password, updatedAt };
      });

      if (!didUpdate) {
        throw new Error("User not found for this reset link.");
      }

      persistUsers(nextUsers);
    },
    [persistUsers, storedUsers]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      users: storedUsers.map(toPublicUser),
      login,
      logout,
      hasPermission,
      createUser,
      updateUser,
      setUserActive,
      changePasswordFromReset,
    }),
    [
      currentUser,
      storedUsers,
      login,
      logout,
      hasPermission,
      createUser,
      updateUser,
      setUserActive,
      changePasswordFromReset,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}

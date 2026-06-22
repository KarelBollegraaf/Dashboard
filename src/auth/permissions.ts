import type { DashboardUser, Permission, UserRole } from "./types";

export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  group: "Dashboard" | "Screens" | "User management" | "Settings";
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "dashboard.access",
    label: "Dashboard access",
    description: "Can log in to this client dashboard.",
    group: "Dashboard",
  },
  {
    key: "overview.view",
    label: "Overview",
    description: "Can view the main overview screen.",
    group: "Screens",
  },
  {
    key: "bales.view",
    label: "Bales",
    description: "Can view bale lists and bale details.",
    group: "Screens",
  },
  {
    key: "cycles.view",
    label: "Cycle times",
    description: "Can view cycle time screens.",
    group: "Screens",
  },
  {
    key: "pressure.view",
    label: "Pressure",
    description: "Can view pressure screens.",
    group: "Screens",
  },
  {
    key: "quality.view",
    label: "Quality rules",
    description: "Can view quality rule screens.",
    group: "Screens",
  },
  {
    key: "events.view",
    label: "Events",
    description: "Can view event messages.",
    group: "Screens",
  },
  {
    key: "raw.view",
    label: "Raw messages",
    description: "Can view raw MQTT/API data.",
    group: "Screens",
  },
  {
    key: "users.view",
    label: "View users",
    description: "Can view dashboard users.",
    group: "User management",
  },
  {
    key: "users.create",
    label: "Create users",
    description: "Can create new users.",
    group: "User management",
  },
  {
    key: "users.edit",
    label: "Edit users",
    description: "Can edit existing users.",
    group: "User management",
  },
  {
    key: "users.disable",
    label: "Disable users",
    description: "Can disable or enable user accounts.",
    group: "User management",
  },
  {
    key: "users.login.edit",
    label: "Change login details",
    description: "Can change email addresses and passwords.",
    group: "User management",
  },
  {
    key: "permissions.edit.basic",
    label: "Edit basic permissions",
    description: "Can edit permissions for basic user accounts.",
    group: "User management",
  },
  {
    key: "permissions.edit.customer",
    label: "Edit customer manager permissions",
    description: "Can edit permissions for customer management accounts.",
    group: "User management",
  },
  {
    key: "settings.view",
    label: "View settings",
    description: "Can view dashboard settings.",
    group: "Settings",
  },
  {
    key: "settings.edit",
    label: "Edit settings",
    description: "Can edit dashboard settings.",
    group: "Settings",
  },
];

export const DASHBOARD_NAV_ITEMS: Array<{
  to: string;
  label: string;
  permission: Permission;
  end?: boolean;
}> = [
  { to: "/", label: "Overview", permission: "overview.view", end: true },
  { to: "/bales", label: "Bales", permission: "bales.view" },
  { to: "/cycles", label: "Cycle Times", permission: "cycles.view" },
  { to: "/pressure", label: "Pressure", permission: "pressure.view" },
  { to: "/quality", label: "Quality Rules", permission: "quality.view" },
  { to: "/events", label: "Events", permission: "events.view" },
  { to: "/raw", label: "Raw Messages", permission: "raw.view" },
  { to: "/users", label: "Users", permission: "users.view" },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  basic: "Basic user",
  customer_management: "Customer management",
  internal_management: "Internal management",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  basic: ["dashboard.access", "overview.view", "bales.view"],
  customer_management: [
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
  ],
  internal_management: ["*"],
};

export function hasUserPermission(
  user: DashboardUser | null | undefined,
  permission?: Permission
) {
  if (!permission) return true;
  if (!user || !user.isActive) return false;
  if (user.role === "internal_management") return true;
  if (user.permissions.includes("*")) return true;

  return user.permissions.includes(permission);
}

export function canManageRole(
  currentUser: DashboardUser | null | undefined,
  targetRole: UserRole
) {
  if (!currentUser || !currentUser.isActive) return false;
  if (currentUser.role === "internal_management") return true;

  if (currentUser.role === "customer_management") {
    return (
      targetRole === "basic" &&
      hasUserPermission(currentUser, "permissions.edit.basic")
    );
  }

  return false;
}

export function getAssignableRoles(
  currentUser: DashboardUser | null | undefined
): UserRole[] {
  if (!currentUser) return [];
  if (currentUser.role === "internal_management") {
    return ["basic", "customer_management", "internal_management"];
  }

  if (currentUser.role === "customer_management") {
    return ["basic"];
  }

  return [];
}

export function getDefaultPathForUser(user: DashboardUser) {
  const item = DASHBOARD_NAV_ITEMS.find((navItem) =>
    hasUserPermission(user, navItem.permission)
  );

  return item?.to || "/";
}

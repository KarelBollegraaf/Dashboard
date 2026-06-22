import { FormEvent, useMemo, useState } from "react";
import { Plus, Save, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_ROLE_PERMISSIONS,
  getAssignableRoles,
  PERMISSION_DEFINITIONS,
  ROLE_LABELS,
} from "@/auth/permissions";
import { useAuth } from "@/auth/AuthProvider";
import type { DashboardUser, Permission, UserRole } from "@/auth/types";
import { sendUserInvite, sendUserPasswordReset } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UserFormState {
  id?: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
}

const emptyForm: UserFormState = {
  email: "",
  name: "",
  password: "",
  role: "basic",
  permissions: DEFAULT_ROLE_PERMISSIONS.basic,
  isActive: true,
};

function toFormState(user: DashboardUser): UserFormState {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password: "",
    role: user.role,
    permissions: user.permissions,
    isActive: user.isActive,
  };
}

function PermissionCheckbox({
  permission,
  checked,
  disabled,
  onChange,
}: {
  permission: Permission;
  checked: boolean;
  disabled: boolean;
  onChange: (permission: Permission, checked: boolean) => void;
}) {
  const definition = PERMISSION_DEFINITIONS.find((item) => item.key === permission);

  if (!definition) return null;

  return (
    <label className="flex items-start gap-3 rounded-md border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(permission, event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">
          {definition.label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {definition.description}
        </span>
      </span>
    </label>
  );
}

export default function UserManagementPage() {
  const {
    currentUser,
    users,
    hasPermission,
    createUser,
    updateUser,
    setUserActive,
  } = useAuth();

  const assignableRoles = getAssignableRoles(currentUser);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmailUserId, setSendingEmailUserId] = useState<string | null>(null);

  const canCreate = hasPermission("users.create");
  const canEdit = hasPermission("users.edit");
  const canDisable = hasPermission("users.disable");
  const canSendLoginEmail = hasPermission("users.login.edit");
  const isEditing = !!form.id;

  const groupedPermissions = useMemo(() => {
    return PERMISSION_DEFINITIONS.filter(
      (permission) => permission.key !== "*"
    ).reduce<Record<string, Permission[]>>((acc, permission) => {
      acc[permission.group] = acc[permission.group] || [];
      acc[permission.group].push(permission.key);
      return acc;
    }, {});
  }, []);

  function resetForm() {
    const defaultRole = assignableRoles[0] || "basic";
    setForm({
      ...emptyForm,
      role: defaultRole,
      permissions: DEFAULT_ROLE_PERMISSIONS[defaultRole],
    });
  }

  function handleRoleChange(role: UserRole) {
    setForm((current) => ({
      ...current,
      role,
      permissions: DEFAULT_ROLE_PERMISSIONS[role],
    }));
  }

  function handlePermissionChange(permission: Permission, checked: boolean) {
    setForm((current) => {
      const permissions = checked
        ? Array.from(new Set([...current.permissions, permission]))
        : current.permissions.filter((item) => item !== permission);

      return {
        ...current,
        permissions,
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      if (form.id) {
        updateUser(form.id, {
          email: form.email,
          name: form.name,
          password: form.password || undefined,
          role: form.role,
          permissions: form.permissions,
          isActive: form.isActive,
        });
        setMessage("User updated.");
      } else {
        createUser({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          permissions: form.permissions,
          isActive: form.isActive,
        });
        setMessage("User created.");
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "User change failed.");
    }
  }

  function handleEdit(user: DashboardUser) {
    setError(null);
    setMessage(null);
    setForm(toFormState(user));
  }

  function handleActiveChange(user: DashboardUser, isActive: boolean) {
    setError(null);
    setMessage(null);

    try {
      setUserActive(user.id, isActive);
      setMessage(isActive ? "User enabled." : "User disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed.");
    }
  }

  async function handleSendInvite(user: DashboardUser) {
    setError(null);
    setMessage(null);
    setSendingEmailUserId(user.id);

    try {
      await sendUserInvite({ id: user.id, email: user.email, name: user.name });
      setMessage(`Invite email sent to ${user.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite email failed.");
    } finally {
      setSendingEmailUserId(null);
    }
  }

  async function handleSendPasswordReset(user: DashboardUser) {
    setError(null);
    setMessage(null);
    setSendingEmailUserId(user.id);

    try {
      await sendUserPasswordReset({ id: user.id, email: user.email, name: user.name });
      setMessage(`Password reset email sent to ${user.email}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Password reset email failed."
      );
    } finally {
      setSendingEmailUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            User management
          </h1>
          <p className="text-muted-foreground">
            Manage client-local users, account levels, and screen permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          New user
        </button>
      </div>

      {(message || error) && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            error
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-foreground"
          )}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold text-foreground">
              Existing users
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">
                        {user.name}
                      </div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        className={
                          user.isActive
                            ? "bg-status-running text-white"
                            : "bg-status-idle text-white"
                        }
                      >
                        {user.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {user.permissions.includes("*")
                        ? "Full access"
                        : `${user.permissions.length} permission(s)`}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendInvite(user)}
                          disabled={
                            !canSendLoginEmail || sendingEmailUserId === user.id
                          }
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Invite
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendPasswordReset(user)}
                          disabled={
                            !canSendLoginEmail || sendingEmailUserId === user.id
                          }
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reset email
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(user)}
                          disabled={!canEdit}
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleActiveChange(user, !user.isActive)
                          }
                          disabled={!canDisable || currentUser?.id === user.id}
                          className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {user.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {isEditing ? "Edit user" : "Create user"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Email is used as the login name.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  {isEditing ? "New password" : "Password"}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={isEditing ? "Leave empty to keep current" : ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required={!isEditing}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">
                  Account level
                </span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    handleRoleChange(event.target.value as UserRole)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              Account is active
            </label>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Permissions</h3>
                <p className="text-sm text-muted-foreground">
                  These permissions control which screens and functions are
                  visible for this user.
                </p>
              </div>

              {form.role === "internal_management" ? (
                <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Internal management accounts always have full access inside
                  this client dashboard.
                </div>
              ) : (
                Object.entries(groupedPermissions).map(
                  ([group, permissions]) => (
                    <div key={group} className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        {group}
                      </h4>
                      <div className="grid gap-3">
                        {permissions.map((permission) => (
                          <PermissionCheckbox
                            key={permission}
                            permission={permission}
                            checked={form.permissions.includes(permission)}
                            disabled={
                              currentUser?.role !== "internal_management" &&
                              permission === "permissions.edit.customer"
                            }
                            onChange={handlePermissionChange}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <button
              type="submit"
              disabled={isEditing ? !canEdit : !canCreate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isEditing ? "Save changes" : "Create user"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

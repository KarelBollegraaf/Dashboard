import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useAuth } from "./AuthProvider";
import type { Permission } from "./types";

export function ProtectedRoute({
  permission,
  children,
}: {
  permission?: Permission;
  children?: ReactNode;
}) {
  const location = useLocation();
  const { currentUser, hasPermission } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasPermission(permission)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">No access</h1>
          <p className="mt-3 text-muted-foreground">
            Your account does not have permission to view this screen. Ask a
            customer manager or internal manager to update your access.
          </p>
        </Card>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

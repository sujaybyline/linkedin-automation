import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessRoute } from "../lib/permissions";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!canAccessRoute(user?.role, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

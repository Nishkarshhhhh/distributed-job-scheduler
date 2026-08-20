import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "./Spinner";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner />;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
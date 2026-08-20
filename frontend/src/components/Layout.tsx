import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="font-display font-bold text-lg tracking-tight text-text">
              Scheduler<span className="text-accent">.</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="text-right leading-tight hidden sm:block">
                <div className="text-sm font-medium text-text">{user.name}</div>
                <div className="text-xs font-mono text-text-muted uppercase tracking-wide">{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted hover:text-text hover:border-accent/40 hover:bg-surface-hover transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
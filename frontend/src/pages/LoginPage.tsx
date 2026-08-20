import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[40rem] rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="font-display font-bold text-xl tracking-tight text-text">
            Scheduler<span className="text-accent">.</span>
          </span>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-card p-8">
          <h1 className="font-display text-xl font-bold text-text mb-1">Welcome back</h1>
          <p className="text-sm text-text-muted mb-6">Sign in to manage your jobs</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 shadow-glow transition"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
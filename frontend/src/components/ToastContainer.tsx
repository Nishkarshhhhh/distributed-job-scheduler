import { useToast } from "@/context/ToastContext";

const typeStyles = {
  success: "border-success/30 bg-success/10 text-success",
  error: "border-danger/30 bg-danger/10 text-danger",
  info: "border-accent/30 bg-accent/10 text-accent",
};

const typeIcon = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border ${typeStyles[toast.type]} bg-surface px-4 py-3 shadow-card animate-[fadeIn_0.2s_ease-out]`}
        >
          <span className="font-mono text-sm mt-0.5 shrink-0">{typeIcon[toast.type]}</span>
          <p className="text-sm text-text flex-1">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-text-muted hover:text-text text-sm leading-none shrink-0"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-sm p-6">
        <h3 className="font-display text-base font-bold text-text mb-1.5">{title}</h3>
        <p className="text-sm text-text-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-surface-hover transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              danger ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
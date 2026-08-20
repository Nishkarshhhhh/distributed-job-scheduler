import { JobStatus, JobRunStatus } from "@/types";

const jobStatusConfig: Record<JobStatus, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: "bg-success", text: "text-success", label: "Active" },
  PAUSED: { dot: "bg-warning", text: "text-warning", label: "Paused" },
  DISABLED: { dot: "bg-text-muted", text: "text-text-muted", label: "Disabled" },
};

const runStatusConfig: Record<JobRunStatus, { dot: string; text: string; label: string; pulse?: boolean }> = {
  PENDING: { dot: "bg-text-muted", text: "text-text-muted", label: "Pending" },
  RUNNING: { dot: "bg-info", text: "text-info", label: "Running", pulse: true },
  COMPLETED: { dot: "bg-success", text: "text-success", label: "Completed" },
  FAILED: { dot: "bg-danger", text: "text-danger", label: "Failed" },
  RETRYING: { dot: "bg-warning", text: "text-warning", label: "Retrying", pulse: true },
  CANCELLED: { dot: "bg-text-muted", text: "text-text-muted", label: "Cancelled" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const cfg = jobStatusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: JobRunStatus }) {
  const cfg = runStatusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-medium ${cfg.text}`}>
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  );
}
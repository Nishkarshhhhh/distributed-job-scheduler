import { useState } from "react";
import { Job } from "@/types";
import { JobStatusBadge } from "./StatusBadge";
import { JobRunsPanel } from "./JobRunsPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { triggerJob, pauseJob, resumeJob, deleteJob } from "@/api/jobs.api";
import { useToast } from "@/context/ToastContext";

const railColor: Record<Job["status"], string> = {
  ACTIVE: "bg-success",
  PAUSED: "bg-warning",
  DISABLED: "bg-text-muted",
};

interface JobRowProps {
  job: Job;
  onChanged: () => void;
}

export function JobRow({ job, onChanged }: JobRowProps) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleTrigger() {
    setBusy(true);
    try {
      await triggerJob(job.id);
      setRunsRefreshKey((k) => k + 1);
      setExpanded(true);
      showToast(`"${job.name}" triggered`, "success");
    } catch (err: any) {
      showToast(err.response?.data?.message ?? "Failed to trigger job", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePause() {
    setBusy(true);
    try {
      if (job.status === "PAUSED") {
        await resumeJob(job.id);
        showToast(`"${job.name}" resumed`, "success");
      } else {
        await pauseJob(job.id);
        showToast(`"${job.name}" paused`, "info");
      }
      onChanged();
    } catch (err: any) {
      showToast(err.response?.data?.message ?? "Failed to update job", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirmed() {
    setShowDeleteConfirm(false);
    setBusy(true);
    try {
      await deleteJob(job.id);
      showToast(`"${job.name}" deleted`, "success");
      onChanged();
    } catch (err: any) {
      showToast(err.response?.data?.message ?? "Failed to delete job", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative flex overflow-hidden rounded-xl border border-border bg-surface shadow-card hover:border-accent/30 transition-colors">
        <div className={`w-1 shrink-0 ${railColor[job.status]} ${job.status === "ACTIVE" ? "animate-heartbeat" : ""}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-3 text-left flex-1 min-w-0"
            >
              <span className={`text-text-muted transition-transform text-xs shrink-0 ${expanded ? "rotate-90" : ""}`}>
                ▶
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text truncate">{job.name}</span>
                  <JobStatusBadge status={job.status} />
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider bg-surface-hover px-1.5 py-0.5 rounded">
                    {job.type}
                  </span>
                </div>
                {job.description && (
                  <p className="text-xs text-text-muted truncate mt-0.5">{job.description}</p>
                )}
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:ml-4">
              <button
                onClick={handleTrigger}
                disabled={busy || job.status !== "ACTIVE"}
                className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40 transition"
              >
                Trigger
              </button>
              <button
                onClick={handleTogglePause}
                disabled={busy || job.status === "DISABLED"}
                className="rounded-lg bg-surface-hover px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text disabled:opacity-40 transition"
              >
                {job.status === "PAUSED" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={busy}
                className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 disabled:opacity-40 transition"
              >
                Delete
              </button>
            </div>
          </div>

          {expanded && (
            <div className="px-4 py-3.5 bg-bg/40 border-t border-border">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs mb-3">
                <div>
                  <div className="text-text-muted uppercase tracking-wide text-[10px] mb-0.5">Queue</div>
                  <div className="text-text font-mono">{job.queueName}</div>
                </div>
                <div>
                  <div className="text-text-muted uppercase tracking-wide text-[10px] mb-0.5">Retry Limit</div>
                  <div className="text-text font-mono">{job.retryLimit}</div>
                </div>
                <div>
                  <div className="text-text-muted uppercase tracking-wide text-[10px] mb-0.5">Last Run</div>
                  <div className="text-text font-mono">
                    {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "Never"}
                  </div>
                </div>
              </div>
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
                Run History
              </h4>
              <JobRunsPanel jobId={job.id} refreshKey={runsRefreshKey} />
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete job?"
          message={`"${job.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
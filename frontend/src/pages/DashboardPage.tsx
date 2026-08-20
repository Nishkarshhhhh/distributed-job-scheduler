import { useState, useEffect, useCallback } from "react";
import { Job, JobStatus, CreateJobInput } from "@/types";
import { fetchJobs, createJob as createJobRequest } from "@/api/jobs.api";
import { JobRow } from "@/components/JobRow";
import { CreateJobModal } from "@/components/CreateJobModal";
import { StatsStrip } from "@/components/StatsStrip";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/context/ToastContext";

export function DashboardPage() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetchJobs({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      });
      setJobs(res.items);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  async function handleCreate(input: CreateJobInput) {
    await createJobRequest(input);
    await loadJobs();
    showToast(`"${input.name}" created`, "success");
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Jobs</h1>
          <p className="text-text-muted mt-1 text-sm">Manage and monitor your scheduled jobs</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 shadow-glow transition self-start sm:self-auto"
        >
          + New Job
        </button>
      </div>

      <StatsStrip jobs={jobs} />

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {(["ALL", "ACTIVE", "PAUSED", "DISABLED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? "bg-accent text-white"
                : "bg-surface border border-border text-text-muted hover:text-text hover:border-accent/30"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-text-muted">No jobs yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 text-sm text-accent font-medium hover:underline"
          >
            Create your first job
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onChanged={loadJobs} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateJobModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
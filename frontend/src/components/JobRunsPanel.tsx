import { useEffect, useState, useCallback } from "react";
import { JobRun } from "@/types";
import { fetchJobRuns } from "@/api/jobs.api";
import { RunStatusBadge } from "./StatusBadge";
import { Spinner } from "./Spinner";

export function JobRunsPanel({ jobId, refreshKey }: { jobId: string; refreshKey: number }) {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchJobRuns(jobId);
      setRuns(res.data);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  if (isLoading) return <Spinner />;

  if (runs.length === 0) {
    return <p className="text-sm text-text-muted py-4">No runs yet.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {runs.map((run) => (
        <div key={run.id} className="py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <RunStatusBadge status={run.status} />
            <span className="text-text-muted font-mono text-xs">attempt {run.attempt}</span>
          </div>
          <div className="text-right">
            <div className="text-text-muted font-mono text-xs">
              {new Date(run.createdAt).toLocaleString()}
            </div>
            {run.error && (
              <div className="text-danger text-xs mt-0.5 max-w-xs truncate font-mono">{run.error}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
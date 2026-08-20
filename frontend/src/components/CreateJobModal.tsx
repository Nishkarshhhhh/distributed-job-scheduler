import { useState, FormEvent } from "react";
import { CreateJobInput, JobType, BackoffType } from "@/types";

interface CreateJobModalProps {
  onClose: () => void;
  onCreate: (input: CreateJobInput) => Promise<void>;
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition";
const labelClass = "block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5";

export function CreateJobModal({ onClose, onCreate }: CreateJobModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<JobType>("ONE_TIME");
  const [cronExpression, setCronExpression] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [queueName, setQueueName] = useState("default");
  const [retryLimit, setRetryLimit] = useState(3);
  const [backoffType, setBackoffType] = useState<BackoffType>("EXPONENTIAL");
  const [backoffDelayMs, setBackoffDelayMs] = useState(5000);
  const [runAt, setRunAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadText || "{}");
    } catch {
      setError("Payload must be valid JSON");
      return;
    }

    if (type === "CRON" && !cronExpression.trim()) {
      setError("Cron expression is required for CRON jobs");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name,
        description: description || undefined,
        type,
        cronExpression: type === "CRON" ? cronExpression : undefined,
        payload,
        queueName,
        retryLimit,
        backoffType,
        backoffDelayMs,
        runAt: type === "ONE_TIME" && runAt ? new Date(runAt).toISOString() : undefined,
      });
      onClose();
    } catch (err: any) {
      const details = err.response?.data?.details;
      setError(details?.[0]?.message ?? err.response?.data?.message ?? "Failed to create job");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border rounded-2xl shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">Create Job</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-xl leading-none w-7 h-7 rounded-lg hover:bg-surface-hover transition"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Send welcome emails" />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>

          <div>
            <label className={labelClass}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as JobType)} className={inputClass}>
              <option value="ONE_TIME">One Time</option>
              <option value="CRON">Cron (recurring)</option>
            </select>
          </div>

          {type === "CRON" ? (
            <div>
              <label className={labelClass}>Cron Expression</label>
              <input
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="*/5 * * * *"
              />
              <p className="text-xs text-text-muted mt-1 font-mono">standard 5-field cron syntax</p>
            </div>
          ) : (
            <div>
              <label className={labelClass}>
                Run At <span className="normal-case text-text-muted/70">(blank = run immediately)</span>
              </label>
              <input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} className={inputClass} />
            </div>
          )}

          <div>
            <label className={labelClass}>Payload (JSON)</label>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              rows={3}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Queue Name</label>
              <input value={queueName} onChange={(e) => setQueueName(e.target.value)} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>Retry Limit</label>
              <input
                type="number"
                min={0}
                max={20}
                value={retryLimit}
                onChange={(e) => setRetryLimit(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Backoff Type</label>
              <select value={backoffType} onChange={(e) => setBackoffType(e.target.value as BackoffType)} className={inputClass}>
                <option value="EXPONENTIAL">Exponential</option>
                <option value="FIXED">Fixed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Backoff Delay (ms)</label>
              <input
                type="number"
                min={0}
                value={backoffDelayMs}
                onChange={(e) => setBackoffDelayMs(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface-hover transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 shadow-glow transition"
            >
              {isSubmitting ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
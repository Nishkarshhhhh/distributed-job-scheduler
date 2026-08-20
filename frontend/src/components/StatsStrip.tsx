import { Job } from "@/types";

export function StatsStrip({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => j.status === "ACTIVE").length;
  const paused = jobs.filter((j) => j.status === "PAUSED").length;
  const cron = jobs.filter((j) => j.type === "CRON").length;
  const total = jobs.length;

  const stats = [
    { label: "Total Jobs", value: total, accent: "text-text" },
    { label: "Active", value: active, accent: "text-success" },
    { label: "Paused", value: paused, accent: "text-warning" },
    { label: "Recurring", value: cron, accent: "text-info" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-card">
          <div className={`font-display text-2xl font-bold ${s.accent}`}>{s.value}</div>
          <div className="text-[11px] text-text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { enqueueJob } from "./queue.producer";
import { ensureWorkerForQueue } from "./queue.manager";
import { getNextCronRun } from "../utils/cron";

const POLL_INTERVAL_MS = 30_000;

let intervalHandle: NodeJS.Timeout | null = null;

async function pollDueJobs(): Promise<void> {
  const now = new Date();

  const dueJobs = await prisma.job.findMany({
    where: {
      type: "CRON",
      status: "ACTIVE",
      nextRunAt: { lte: now },
    },
  });

  for (const job of dueJobs) {
    try {
      if (!job.cronExpression) continue;

      const nextRunAt = getNextCronRun(job.cronExpression, now);

      // Optimistic claim: only proceed if nextRunAt hasn't changed since we read it.
      // Prevents double-triggering if multiple scheduler instances poll concurrently.
      const claim = await prisma.job.updateMany({
        where: { id: job.id, nextRunAt: job.nextRunAt },
        data: { nextRunAt },
      });

      if (claim.count === 0) {
        // Another instance already claimed and rescheduled this job — skip.
        continue;
      }

      ensureWorkerForQueue(job.queueName);
      await enqueueJob(job);

      logger.info(
        `⏰ Cron job triggered: "${job.name}" (${job.id}), next run at ${nextRunAt.toISOString()}`
      );
    } catch (err: any) {
      logger.error(`Failed to process due cron job ${job.id}`, { error: err.message });
    }
  }
}

export function startScheduler(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    pollDueJobs().catch((err) => logger.error("Scheduler poll failed", { error: err.message }));
  }, POLL_INTERVAL_MS);
  logger.info(`⏰ Cron scheduler started (polling every ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("⏰ Cron scheduler stopped");
  }
}
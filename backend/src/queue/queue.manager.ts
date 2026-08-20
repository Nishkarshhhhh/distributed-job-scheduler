import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { createWorker } from "./queue.worker";
import { DEFAULT_QUEUE_NAME } from "./queue.constants";
import { logger } from "../config/logger";
import { env } from "../config/env";

const activeWorkers = new Map<string, Worker>();
let discoveryInterval: NodeJS.Timeout | null = null;

export async function discoverAndStartWorkers(explicitQueues?: string[]): Promise<void> {
  let queueNames: Set<string>;

  if (explicitQueues && explicitQueues.length > 0) {
    queueNames = new Set(explicitQueues.map((q) => q.trim()).filter(Boolean));
  } else {
    try {
      const distinctQueues = await prisma.job.findMany({
        distinct: ["queueName"],
        select: { queueName: true },
      });
      queueNames = new Set<string>([
        DEFAULT_QUEUE_NAME,
        ...distinctQueues.map((q) => q.queueName),
      ]);
    } catch (err: any) {
      logger.warn("Could not query distinct queues from database, falling back to default", {
        error: err?.message,
      });
      queueNames = new Set<string>([DEFAULT_QUEUE_NAME]);
    }
  }

  for (const name of queueNames) {
    if (!activeWorkers.has(name)) {
      activeWorkers.set(name, createWorker(name, env.WORKER_CONCURRENCY));
      logger.info(`👷 Worker started for queue "${name}" (concurrency: ${env.WORKER_CONCURRENCY})`);
    }
  }
}

export function startQueueDiscovery(intervalMs: number = 60_000): void {
  if (discoveryInterval) return;
  discoveryInterval = setInterval(async () => {
    try {
      await discoverAndStartWorkers();
    } catch (err: any) {
      logger.error("Queue discovery error", { error: err?.message });
    }
  }, intervalMs);
}

export async function stopWorkers(): Promise<void> {
  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }
  await Promise.all([...activeWorkers.values()].map((w) => w.close()));
  activeWorkers.clear();
  logger.info("🛑 All workers stopped");
}

export function getActiveWorkerQueues(): string[] {
  return [...activeWorkers.keys()];
}
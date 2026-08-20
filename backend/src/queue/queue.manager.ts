import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { createWorker } from "./queue.worker";
import { DEFAULT_QUEUE_NAME } from "./queue.constants";
import { logger } from "../config/logger";

const activeWorkers = new Map<string, Worker>();

export async function startWorkers(): Promise<void> {
  const distinctQueues = await prisma.job.findMany({
    distinct: ["queueName"],
    select: { queueName: true },
  });

  const queueNames = new Set<string>([
    DEFAULT_QUEUE_NAME,
    ...distinctQueues.map((q) => q.queueName),
  ]);

  for (const name of queueNames) {
    if (!activeWorkers.has(name)) {
      activeWorkers.set(name, createWorker(name));
      logger.info(`👷 Worker started for queue "${name}"`);
    }
  }
}

export function ensureWorkerForQueue(queueName: string): void {
  if (!activeWorkers.has(queueName)) {
    activeWorkers.set(queueName, createWorker(queueName));
    logger.info(`👷 Worker started for queue "${queueName}"`);
  }
}

export async function stopWorkers(): Promise<void> {
  await Promise.all([...activeWorkers.values()].map((w) => w.close()));
  activeWorkers.clear();
  logger.info("🛑 All workers stopped");
}
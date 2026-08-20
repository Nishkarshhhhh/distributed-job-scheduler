import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { disconnectRedis } from "./config/redis";
import { discoverAndStartWorkers, startQueueDiscovery, stopWorkers } from "./queue/queue.manager";
import { closeAllQueues } from "./queue/queue.registry";
import { logger } from "./config/logger";

async function start() {
  logger.info("🚀 Starting Job Scheduler Worker process...");
  await connectDatabase();

  const explicitQueues = process.env.QUEUES ? process.env.QUEUES.split(",") : undefined;
  await discoverAndStartWorkers(explicitQueues);
  startQueueDiscovery(60_000);

  logger.info(`✅ Worker process active (concurrency: ${env.WORKER_CONCURRENCY})`);

  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`${signal} received. Shutting down worker gracefully...`);

    const timeout = setTimeout(() => {
      logger.error("Forced worker shutdown after timeout.");
      process.exit(1);
    }, 15000);
    timeout.unref();

    try {
      await stopWorkers();
      await closeAllQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("Worker process terminated cleanly.");
      process.exit(0);
    } catch (err: any) {
      logger.error("Error during worker shutdown", { error: err?.message });
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("❌ Failed to start worker process", { error: err.message, stack: err.stack });
  process.exit(1);
});

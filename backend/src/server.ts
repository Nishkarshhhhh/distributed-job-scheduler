import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { disconnectRedis } from "./config/redis";
import { closeAllQueues } from "./queue/queue.registry";
import { logger } from "./config/logger";
import { startScheduler, stopScheduler } from "./queue/scheduler.service";
import { discoverAndStartWorkers, startQueueDiscovery, stopWorkers } from "./queue/queue.manager";

const app = createApp();

async function start() {
  await connectDatabase();
  startScheduler();

  if (env.WORKER_MODE === "embedded") {
    logger.info(`👷 Starting embedded BullMQ worker (concurrency: ${env.WORKER_CONCURRENCY})...`);
    const explicitQueues = process.env.QUEUES ? process.env.QUEUES.split(",") : undefined;
    await discoverAndStartWorkers(explicitQueues);
    startQueueDiscovery(60_000);
    logger.info(`✅ Embedded worker active in API process (concurrency: ${env.WORKER_CONCURRENCY})`);
  } else {
    logger.info("ℹ️ Running in distributed worker mode (standalone worker process required)");
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Job Scheduler backend running on port ${env.PORT} [${env.NODE_ENV}] [worker: ${env.WORKER_MODE}]`);
  });

  function shutdown(signal: string) {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      stopScheduler();
      if (env.WORKER_MODE === "embedded") {
        await stopWorkers();
      }
      await closeAllQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("❌ Failed to start server", { error: err.message, stack: err.stack });
  process.exit(1);
});
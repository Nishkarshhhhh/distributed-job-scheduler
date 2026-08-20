import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/prisma";
import { disconnectRedis } from "./config/redis";
import { startWorkers, stopWorkers } from "./queue/queue.manager";
import { closeAllQueues } from "./queue/queue.registry";
import { logger } from "./config/logger";
import { startScheduler, stopScheduler } from "./queue/scheduler.service";

const app = createApp();

async function start() {
  await connectDatabase();
  await startWorkers();
  startScheduler();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Job Scheduler backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  function shutdown(signal: string) {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      stopScheduler();
      await stopWorkers();
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
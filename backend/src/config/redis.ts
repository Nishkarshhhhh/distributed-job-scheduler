import IORedis, { RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export function createRedisConnection(customOpts?: Partial<RedisOptions>): IORedis {
  const client = new IORedis({
    ...redisOptions,
    ...customOpts,
  });

  client.on("error", (err) => {
    logger.error("❌ Redis connection error", { error: err.message });
  });

  return client;
}

let standaloneClient: IORedis | null = null;

export function getStandaloneRedisClient(): IORedis {
  if (!standaloneClient) {
    standaloneClient = createRedisConnection();
    standaloneClient.on("connect", () => {
      logger.info("✅ Redis connected");
    });
  }
  return standaloneClient;
}

export async function disconnectRedis(): Promise<void> {
  if (standaloneClient) {
    await standaloneClient.quit();
    standaloneClient = null;
    logger.info("🔌 Redis disconnected");
  }
}
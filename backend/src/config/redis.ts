import IORedis, { RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export function parseRedisUrl(urlString: string): RedisOptions {
  const parsed = new URL(urlString);
  const isTls = parsed.protocol === "rediss:";

  const options: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : (isTls ? 6380 : 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (parsed.pathname && parsed.pathname.length > 1) {
    const dbIndex = parseInt(parsed.pathname.slice(1), 10);
    if (!isNaN(dbIndex)) {
      options.db = dbIndex;
    }
  }

  if (isTls) {
    options.tls = {
      rejectUnauthorized: false,
    };
  }

  return options;
}

export function buildRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL || env.REDIS_URL;
  if (redisUrl && redisUrl.trim() !== "") {
    return parseRedisUrl(redisUrl.trim());
  }

  return {
    host: process.env.REDIS_HOST || env.REDIS_HOST,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD ?? env.REDIS_PASSWORD ?? undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export const redisOptions: RedisOptions = buildRedisOptions();

export function createRedisConnection(customOpts?: Partial<RedisOptions>): IORedis {
  const redisUrl = process.env.REDIS_URL || env.REDIS_URL;
  const client =
    redisUrl && redisUrl.trim() !== ""
      ? new IORedis(redisUrl.trim(), {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          ...(redisUrl.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
          ...customOpts,
        })
      : new IORedis({
          ...buildRedisOptions(),
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
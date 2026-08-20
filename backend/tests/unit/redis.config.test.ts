import { parseRedisUrl, buildRedisOptions } from "../../src/config/redis";

describe("Redis Configuration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("parseRedisUrl", () => {
    it("parses standard redis:// URL without authentication", () => {
      const opts = parseRedisUrl("redis://redis.render.com:6379");
      expect(opts.host).toBe("redis.render.com");
      expect(opts.port).toBe(6379);
      expect(opts.password).toBeUndefined();
      expect(opts.tls).toBeUndefined();
      expect(opts.maxRetriesPerRequest).toBeNull();
      expect(opts.enableReadyCheck).toBe(false);
    });

    it("parses redis:// URL with username, password, and database index", () => {
      const opts = parseRedisUrl("redis://default:mysecretpassword@redis.internal:6380/2");
      expect(opts.host).toBe("redis.internal");
      expect(opts.port).toBe(6380);
      expect(opts.username).toBe("default");
      expect(opts.password).toBe("mysecretpassword");
      expect(opts.db).toBe(2);
      expect(opts.maxRetriesPerRequest).toBeNull();
    });

    it("parses rediss:// TLS URL and configures TLS correctly", () => {
      const opts = parseRedisUrl("rediss://default:render_pw@red-xyz123.render.com:6379");
      expect(opts.host).toBe("red-xyz123.render.com");
      expect(opts.port).toBe(6379);
      expect(opts.password).toBe("render_pw");
      expect(opts.tls).toEqual({ rejectUnauthorized: false });
      expect(opts.maxRetriesPerRequest).toBeNull();
      expect(opts.enableReadyCheck).toBe(false);
    });
  });

  describe("buildRedisOptions", () => {
    it("uses REDIS_URL when set in environment", () => {
      process.env.REDIS_URL = "redis://custom-host:6388";
      const opts = buildRedisOptions();
      expect(opts.host).toBe("custom-host");
      expect(opts.port).toBe(6388);
    });

    it("falls back to host, port, password when REDIS_URL is not set", () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = "fallback-host";
      process.env.REDIS_PORT = "6399";
      process.env.REDIS_PASSWORD = "fallback-pw";

      const opts = buildRedisOptions();
      expect(opts.host).toBe("fallback-host");
      expect(opts.port).toBe(6399);
      expect(opts.password).toBe("fallback-pw");
      expect(opts.maxRetriesPerRequest).toBeNull();
      expect(opts.enableReadyCheck).toBe(false);
    });
  });
});

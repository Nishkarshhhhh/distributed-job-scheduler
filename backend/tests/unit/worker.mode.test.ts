import { z } from "zod";
import * as queueManager from "../../src/queue/queue.manager";

describe("Worker Mode Configuration and Lifecycle", () => {
  const envSchema = z.object({
    WORKER_MODE: z.enum(["distributed", "embedded"]).default("distributed"),
  });

  it("defaults WORKER_MODE to distributed when not specified", () => {
    const parsed = envSchema.parse({});
    expect(parsed.WORKER_MODE).toBe("distributed");
  });

  it("accepts explicit distributed WORKER_MODE", () => {
    const parsed = envSchema.parse({ WORKER_MODE: "distributed" });
    expect(parsed.WORKER_MODE).toBe("distributed");
  });

  it("accepts explicit embedded WORKER_MODE", () => {
    const parsed = envSchema.parse({ WORKER_MODE: "embedded" });
    expect(parsed.WORKER_MODE).toBe("embedded");
  });

  it("rejects invalid WORKER_MODE values", () => {
    const result = envSchema.safeParse({ WORKER_MODE: "invalid_mode" });
    expect(result.success).toBe(false);
  });

  it("starts and stops embedded workers cleanly without duplicate queue workers", async () => {
    const queueName = `mode-test-q-${Date.now()}`;
    await queueManager.discoverAndStartWorkers([queueName]);

    let activeQueues = queueManager.getActiveWorkerQueues();
    expect(activeQueues).toContain(queueName);

    // Calling discoverAndStartWorkers again must not create duplicates
    await queueManager.discoverAndStartWorkers([queueName]);
    activeQueues = queueManager.getActiveWorkerQueues();
    const count = activeQueues.filter((q) => q === queueName).length;
    expect(count).toBe(1);

    // Graceful stop
    await queueManager.stopWorkers();
    expect(queueManager.getActiveWorkerQueues()).toHaveLength(0);
  });
});

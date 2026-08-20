import http from "http";
import { AddressInfo } from "net";
import { prisma } from "../../src/config/prisma";
import { disconnectRedis } from "../../src/config/redis";
import { createWorker } from "../../src/queue/queue.worker";
import { enqueueJob } from "../../src/queue/queue.producer";
import { closeAllQueues, getQueue } from "../../src/queue/queue.registry";
import { Worker } from "bullmq";

describe("Worker Integration Tests (BullMQ + Redis + Postgres + HTTP)", () => {
  let server: http.Server;
  let serverPort: number;
  let receivedRequests: Array<{ method: string; url: string; body: string; headers: http.IncomingHttpHeaders }> = [];
  let serverHandler: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null = null;
  let testUserId: string;
  let activeWorkers: Worker[] = [];

  beforeAll(async () => {
    process.env.ALLOW_INTERNAL_NETWORK_REQUESTS = "true";

    // 1. Start mock target HTTP server
    await new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          receivedRequests.push({
            method: req.method || "GET",
            url: req.url || "/",
            body,
            headers: req.headers,
          });

          if (serverHandler) {
            serverHandler(req, res);
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", received: true }));
          }
        });
      });

      server.listen(0, "127.0.0.1", () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    // 2. Create test user
    const user = await prisma.user.create({
      data: {
        email: `worker-test-${Date.now()}@example.com`,
        passwordHash: "hash123",
        name: "Worker Test User",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    delete process.env.ALLOW_INTERNAL_NETWORK_REQUESTS;

    for (const w of activeWorkers) {
      await w.close();
    }
    activeWorkers = [];

    await closeAllQueues();
    await disconnectRedis();

    if (testUserId) {
      await prisma.jobRun.deleteMany({ where: { job: { ownerId: testUserId } } });
      await prisma.job.deleteMany({ where: { ownerId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }

    await prisma.$disconnect();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    receivedRequests = [];
    serverHandler = null;
  });

  it("processes an HTTP POST job to completion via BullMQ worker", async () => {
    const queueName = `integration-q-${Date.now()}`;
    const worker = createWorker(queueName, 2);
    activeWorkers.push(worker);

    const job = await prisma.job.create({
      data: {
        name: "HTTP Post Test Job",
        type: "ONE_TIME",
        executionType: "HTTP",
        queueName,
        ownerId: testUserId,
        payload: {
          url: `http://127.0.0.1:${serverPort}/api/webhook`,
          method: "POST",
          headers: { "X-Custom-Auth": "secret-token" },
          body: { event: "order.created", orderId: 999 },
          timeoutMs: 5000,
        },
      },
    });

    const { jobRun } = await enqueueJob(job);

    // Wait for the worker to process the job
    let finalRun = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      finalRun = await prisma.jobRun.findUnique({ where: { id: jobRun.id } });
      if (finalRun && (finalRun.status === "COMPLETED" || finalRun.status === "FAILED")) {
        break;
      }
    }

    expect(finalRun).not.toBeNull();
    expect(finalRun?.status).toBe("COMPLETED");
    expect(finalRun?.httpStatus).toBe(200);
    expect(finalRun?.finishedAt).not.toBeNull();
    expect(receivedRequests.length).toBe(1);
    expect(receivedRequests[0].method).toBe("POST");
    expect(receivedRequests[0].headers["x-custom-auth"]).toBe("secret-token");
    expect(JSON.parse(receivedRequests[0].body)).toEqual({ event: "order.created", orderId: 999 });
  });

  it("multiple concurrent workers safely share the same queue without duplication", async () => {
    const queueName = `multi-worker-q-${Date.now()}`;
    const worker1 = createWorker(queueName, 3);
    const worker2 = createWorker(queueName, 3);
    activeWorkers.push(worker1, worker2);

    const jobCount = 6;
    const jobRunIds: string[] = [];

    for (let i = 0; i < jobCount; i++) {
      const job = await prisma.job.create({
        data: {
          name: `Concurrent Job ${i}`,
          type: "ONE_TIME",
          executionType: "HTTP",
          queueName,
          ownerId: testUserId,
          payload: {
            url: `http://127.0.0.1:${serverPort}/concurrent-${i}`,
            method: "GET",
          },
        },
      });
      const { jobRun } = await enqueueJob(job);
      jobRunIds.push(jobRun.id);
    }

    // Wait for all jobs to complete
    let allCompleted = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const runs = await prisma.jobRun.findMany({
        where: { id: { in: jobRunIds } },
      });
      if (runs.every((r) => r.status === "COMPLETED")) {
        allCompleted = true;
        break;
      }
    }

    expect(allCompleted).toBe(true);
    expect(receivedRequests.length).toBe(jobCount);
  });
});

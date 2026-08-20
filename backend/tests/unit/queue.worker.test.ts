import { createWorker, abortRunningExecution } from "../../src/queue/queue.worker";
import { prisma } from "../../src/config/prisma";
import * as executorRegistry from "../../src/executors/executor.registry";
import { UnrecoverableError } from "bullmq";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    jobRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    job: {
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/config/redis", () => ({
  redisOptions: { host: "localhost", port: 6379 },
}));

const mockedPrisma = prisma as unknown as {
  jobRun: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  job: {
    update: jest.Mock;
  };
};

describe("queue.worker unit tests", () => {
  let mockExecutor: { execute: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecutor = {
      execute: jest.fn(),
    };
    jest.spyOn(executorRegistry, "getJobExecutor").mockReturnValue(mockExecutor as any);
  });

  it("processes a job to completion and transitions state PENDING -> RUNNING -> COMPLETED", async () => {
    const worker = createWorker("test-queue", 1);
    const processor = (worker as any).processFn;

    mockedPrisma.jobRun.findUnique.mockResolvedValue({
      id: "run-1",
      jobId: "job-1",
      status: "PENDING",
    });

    mockedPrisma.jobRun.update.mockResolvedValue({ id: "run-1", status: "RUNNING" });
    mockedPrisma.jobRun.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.job.update.mockResolvedValue({ id: "job-1" });

    mockExecutor.execute.mockResolvedValue({
      success: true,
      httpStatus: 200,
      durationMs: 150,
      responseBody: '{"ok": true}',
    });

    const mockBullJob = {
      name: "execute-job",
      data: {
        jobId: "job-1",
        jobRunId: "run-1",
        executionType: "HTTP",
        payload: { url: "http://example.com/webhook", method: "POST" },
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    const result = await processor(mockBullJob);

    expect(mockedPrisma.jobRun.findUnique).toHaveBeenCalledWith({ where: { id: "run-1" } });
    expect(mockedPrisma.jobRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "RUNNING", attempt: 1 }),
    });
    expect(mockExecutor.execute).toHaveBeenCalled();
    expect(mockedPrisma.jobRun.updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", status: { not: "CANCELLED" } },
      data: expect.objectContaining({
        status: "COMPLETED",
        httpStatus: 200,
        durationMs: 150,
      }),
    });
    expect(mockedPrisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ lastRunAt: expect.any(Date) }),
    });
    expect(result.success).toBe(true);

    await worker.close();
  });

  it("skips execution if the JobRun was already CANCELLED", async () => {
    const worker = createWorker("test-queue-2", 1);
    const processor = (worker as any).processFn;

    mockedPrisma.jobRun.findUnique.mockResolvedValue({
      id: "run-cancelled",
      jobId: "job-1",
      status: "CANCELLED",
    });

    const mockBullJob = {
      name: "execute-job",
      data: {
        jobId: "job-1",
        jobRunId: "run-cancelled",
        executionType: "HTTP",
        payload: { url: "http://example.com" },
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processor(mockBullJob);

    expect(mockedPrisma.jobRun.update).not.toHaveBeenCalled();
    expect(mockExecutor.execute).not.toHaveBeenCalled();

    await worker.close();
  });

  it("supports abortRunningExecution for active runs", () => {
    // If run is not registered, returns false
    expect(abortRunningExecution("non-existent-run")).toBe(false);
  });
});

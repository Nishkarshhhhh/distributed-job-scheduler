import { createJob, listJobs, cancelLatestRun } from "../../src/modules/jobs/jobs.service";
import { prisma } from "../../src/config/prisma";
import * as queueProducer from "../../src/queue/queue.producer";
import * as queueManager from "../../src/queue/queue.manager";
import { Role } from "@prisma/client";
import { ApiError } from "../../src/utils/apiError";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    jobRun: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/queue/queue.producer");
jest.mock("../../src/queue/queue.manager");

const mockedPrisma = prisma as unknown as {
  job: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
  };
  jobRun: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

describe("jobs.service", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createJob", () => {
    it("creates a CRON job without auto-enqueuing", async () => {
      mockedPrisma.job.create.mockResolvedValue({
        id: "job-1",
        type: "CRON",
        queueName: "default",
        nextRunAt: null,
      });

      const job = await createJob(
        {
          name: "Cron Job",
          type: "CRON",
          cronExpression: "*/5 * * * *",
          payload: {},
          queueName: "default",
          retryLimit: 3,
          backoffType: "EXPONENTIAL",
          backoffDelayMs: 5000,
          timeoutMs: 60000,
        } as any,
        "owner-1"
      );

      expect(job.id).toBe("job-1");
      expect(queueManager.ensureWorkerForQueue).toHaveBeenCalledWith("default");
      expect(queueProducer.enqueueJob).not.toHaveBeenCalled();
    });

    it("auto-enqueues a ONE_TIME job", async () => {
      mockedPrisma.job.create.mockResolvedValue({
        id: "job-2",
        type: "ONE_TIME",
        queueName: "default",
        nextRunAt: null,
      });

      await createJob(
        {
          name: "One Time Job",
          type: "ONE_TIME",
          payload: { foo: "bar" },
          queueName: "default",
          retryLimit: 3,
          backoffType: "EXPONENTIAL",
          backoffDelayMs: 5000,
          timeoutMs: 60000,
        } as any,
        "owner-1"
      );

      expect(queueProducer.enqueueJob).toHaveBeenCalledTimes(1);
    });
  });

  describe("listJobs", () => {
    it("scopes results to the owner for non-admin users", async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      mockedPrisma.job.count.mockResolvedValue(0);

      await listJobs({ page: 1, limit: 20 } as any, { id: "owner-1", role: Role.USER });

      expect(mockedPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: "owner-1" }),
        })
      );
    });

    it("does not scope by owner for admin users", async () => {
      mockedPrisma.job.findMany.mockResolvedValue([]);
      mockedPrisma.job.count.mockResolvedValue(0);

      await listJobs({ page: 1, limit: 20 } as any, { id: "admin-1", role: Role.ADMIN });

      const callArgs = mockedPrisma.job.findMany.mock.calls[0][0];
      expect(callArgs.where.ownerId).toBeUndefined();
    });
  });

  describe("cancelLatestRun", () => {
    it("cancels an active run and updates status to CANCELLED", async () => {
      mockedPrisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        ownerId: "owner-1",
        queueName: "default",
      });

      mockedPrisma.jobRun.findFirst.mockResolvedValue({
        id: "run-1",
        jobId: "job-1",
        bullJobId: "bull-1",
        status: "RUNNING",
      });

      (queueProducer.cancelBullJob as jest.Mock).mockResolvedValue(true);

      mockedPrisma.jobRun.update.mockResolvedValue({
        id: "run-1",
        status: "CANCELLED",
        error: "Cancelled by user",
      });

      const result = await cancelLatestRun("job-1", { id: "owner-1", role: Role.USER });

      expect(result.cancelled).toBe(true);
      expect(result.jobRunId).toBe("run-1");
      expect(queueProducer.cancelBullJob).toHaveBeenCalledWith("default", "bull-1");
      expect(mockedPrisma.jobRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          error: "Cancelled by user",
        }),
      });
    });

    it("throws notFound if there is no active run to cancel", async () => {
      mockedPrisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        ownerId: "owner-1",
        queueName: "default",
      });

      mockedPrisma.jobRun.findFirst.mockResolvedValue(null);

      await expect(
        cancelLatestRun("job-1", { id: "owner-1", role: Role.USER })
      ).rejects.toThrow(ApiError);
    });
  });
});
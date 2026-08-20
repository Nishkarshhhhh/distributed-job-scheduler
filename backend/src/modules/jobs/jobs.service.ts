import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import { CreateJobInput, UpdateJobInput, ListJobsQuery } from "./jobs.validation";
import { enqueueJob, cancelBullJob } from "../../queue/queue.producer";
import { ensureWorkerForQueue } from "../../queue/queue.manager";
import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getNextCronRun } from "../../utils/cron";

export type { ListJobsQuery } from "./jobs.validation";

interface RequestingUser {
  id: string;
  role: Role;
}

async function assertOwnership(jobId: string, user: RequestingUser) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    throw ApiError.notFound("Job not found");
  }

  if (job.ownerId !== user.id && user.role !== Role.ADMIN) {
    throw ApiError.forbidden("You do not have access to this job");
  }

  return job;
}

export async function createJob(input: CreateJobInput, ownerId: string) {
  const nextRunAt =
    input.type === "CRON" && input.cronExpression
      ? getNextCronRun(input.cronExpression)
      : input.type === "ONE_TIME" && input.runAt
      ? new Date(input.runAt)
      : null;

  const job = await prisma.job.create({
    data: {
      name: input.name,
      description: input.description,
      type: input.type,
      cronExpression: input.cronExpression,
      payload: input.payload as Prisma.InputJsonValue,
      queueName: input.queueName,
      retryLimit: input.retryLimit,
      backoffType: input.backoffType,
      backoffDelayMs: input.backoffDelayMs,
      timeoutMs: input.timeoutMs,
      ownerId,
      nextRunAt,
    },
  });

  ensureWorkerForQueue(job.queueName);

  if (job.type === "ONE_TIME") {
    const delayMs = job.nextRunAt ? Math.max(0, job.nextRunAt.getTime() - Date.now()) : 0;
    await enqueueJob(job, { delayMs });
  }

  return job;
}

export async function listJobs(query: ListJobsQuery, user: RequestingUser) {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;

  const where: Prisma.JobWhereInput = {
    ...(user.role !== Role.ADMIN ? { ownerId: user.id } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getJobById(jobId: string, user: RequestingUser) {
  return assertOwnership(jobId, user);
}

export async function updateJob(jobId: string, input: UpdateJobInput, user: RequestingUser) {
  const existing = await assertOwnership(jobId, user);

  const nextRunAt =
    input.cronExpression && existing.type === "CRON"
      ? getNextCronRun(input.cronExpression)
      : undefined;

  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      ...input,
      payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
      ...(nextRunAt ? { nextRunAt } : {}),
    },
  });

  return job;
}

export async function deleteJob(jobId: string, user: RequestingUser) {
  await assertOwnership(jobId, user);
  await prisma.job.delete({ where: { id: jobId } });
}

export async function triggerJobNow(jobId: string, user: RequestingUser) {
  const job = await assertOwnership(jobId, user);

  if (job.status !== "ACTIVE") {
    throw ApiError.badRequest("Only ACTIVE jobs can be triggered manually");
  }

  ensureWorkerForQueue(job.queueName);
  const { jobRun } = await enqueueJob(job);
  return jobRun;
}

export async function pauseJob(jobId: string, user: RequestingUser) {
  await assertOwnership(jobId, user);
  return prisma.job.update({ where: { id: jobId }, data: { status: "PAUSED" } });
}

export async function resumeJob(jobId: string, user: RequestingUser) {
  await assertOwnership(jobId, user);
  return prisma.job.update({ where: { id: jobId }, data: { status: "ACTIVE" } });
}

export async function getJobRuns(jobId: string, user: RequestingUser) {
  await assertOwnership(jobId, user);
  return prisma.jobRun.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function cancelLatestRun(jobId: string, user: RequestingUser) {
  const job = await assertOwnership(jobId, user);

  const latestRun = await prisma.jobRun.findFirst({
    where: { jobId, status: { in: ["PENDING", "RUNNING", "RETRYING"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!latestRun) {
    throw ApiError.notFound("No active run to cancel");
  }

  let bullJobCancelled = false;
  if (latestRun.bullJobId) {
    bullJobCancelled = await cancelBullJob(job.queueName, latestRun.bullJobId);
  }

  const updatedRun = await prisma.jobRun.update({
    where: { id: latestRun.id },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
      error: "Cancelled by user",
    },
  });

  return { cancelled: true, jobRunId: updatedRun.id, bullJobCancelled };
}
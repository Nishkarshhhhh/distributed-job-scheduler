-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CRON', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackoffType" AS ENUM ('FIXED', 'EXPONENTIAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "JobType" NOT NULL DEFAULT 'CRON',
    "cronExpression" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "queueName" TEXT NOT NULL DEFAULT 'default',
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "retryLimit" INTEGER NOT NULL DEFAULT 3,
    "backoffType" "BackoffType" NOT NULL DEFAULT 'EXPONENTIAL',
    "backoffDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "bullJobId" TEXT,
    "status" "JobRunStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "jobs_ownerId_idx" ON "jobs"("ownerId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_nextRunAt_idx" ON "jobs"("nextRunAt");

-- CreateIndex
CREATE INDEX "job_runs_jobId_idx" ON "job_runs"("jobId");

-- CreateIndex
CREATE INDEX "job_runs_status_idx" ON "job_runs"("status");

-- CreateIndex
CREATE INDEX "job_runs_bullJobId_idx" ON "job_runs"("bullJobId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "JobExecutionType" AS ENUM ('HTTP');

-- AlterTable
ALTER TABLE "job_runs" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "httpStatus" INTEGER;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "executionType" "JobExecutionType" NOT NULL DEFAULT 'HTTP';

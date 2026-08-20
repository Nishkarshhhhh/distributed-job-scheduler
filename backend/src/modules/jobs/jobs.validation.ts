import { z } from "zod";
import { isValidCron } from "../../utils/cron";

const cronValidation = z
  .string()
  .refine((val) => isValidCron(val), {
    message: "Invalid cron expression",
  });

export const httpPayloadSchema = z.object({
  url: z.string().url("Invalid URL format").optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(1000).max(300_000).optional(),
});

export const createJobSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(150),
      description: z.string().max(1000).optional(),
      type: z.enum(["CRON", "ONE_TIME"]),
      executionType: z.enum(["HTTP"]).default("HTTP"),
      cronExpression: cronValidation.optional(),
      payload: z.record(z.unknown()).default({}),
      queueName: z.string().min(1).max(100).default("default"),
      retryLimit: z.number().int().min(0).max(20).default(3),
      backoffType: z.enum(["FIXED", "EXPONENTIAL"]).default("EXPONENTIAL"),
      backoffDelayMs: z.number().int().min(0).max(3_600_000).default(5000),
      timeoutMs: z.number().int().min(1000).max(3_600_000).default(60000),
      runAt: z.string().datetime().optional(),
    })
    .refine((data) => data.type !== "CRON" || !!data.cronExpression, {
      message: "cronExpression is required when type is CRON",
      path: ["cronExpression"],
    }),
});

export const updateJobSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(150).optional(),
      description: z.string().max(1000).optional(),
      executionType: z.enum(["HTTP"]).optional(),
      cronExpression: cronValidation.optional(),
      payload: z.record(z.unknown()).optional(),
      queueName: z.string().min(1).max(100).optional(),
      status: z.enum(["ACTIVE", "PAUSED", "DISABLED"]).optional(),
      retryLimit: z.number().int().min(0).max(20).optional(),
      backoffType: z.enum(["FIXED", "EXPONENTIAL"]).optional(),
      backoffDelayMs: z.number().int().min(0).max(3_600_000).optional(),
      timeoutMs: z.number().int().min(1000).max(3_600_000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
  params: z.object({
    id: z.string().uuid("Invalid job id"),
  }),
});

export const jobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job id"),
  }),
});

export const listJobsQuerySchema = z.object({
  query: z.object({
    status: z.enum(["ACTIVE", "PAUSED", "DISABLED"]).optional(),
    type: z.enum(["CRON", "ONE_TIME"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateJobInput = z.infer<typeof createJobSchema>["body"];
export type UpdateJobInput = z.infer<typeof updateJobSchema>["body"];
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>["query"];
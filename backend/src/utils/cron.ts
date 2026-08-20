import parser from "cron-parser";
import { ApiError } from "./apiError";

export function isValidCron(cronExpression: string): boolean {
  if (!cronExpression || typeof cronExpression !== "string") return false;
  try {
    parser.parseExpression(cronExpression, { utc: true });
    return true;
  } catch {
    return false;
  }
}

export function getNextCronRun(cronExpression: string, fromDate: Date = new Date()): Date {
  try {
    const interval = parser.parseExpression(cronExpression, { currentDate: fromDate, utc: true });
    return interval.next().toDate();
  } catch {
    throw ApiError.badRequest(`Invalid cron expression: ${cronExpression}`);
  }
}
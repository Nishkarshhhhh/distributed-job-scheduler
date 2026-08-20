import { getNextCronRun, isValidCron } from "../../src/utils/cron";
import { ApiError } from "../../src/utils/apiError";

describe("cron util", () => {
  describe("getNextCronRun", () => {
    it("computes the next run time for a valid cron expression", () => {
      const from = new Date("2026-01-01T00:00:00Z");
      const next = getNextCronRun("0 * * * *", from); // top of every hour
      expect(next.toISOString()).toBe("2026-01-01T01:00:00.000Z");
    });

    it("throws an ApiError for an invalid cron expression", () => {
      expect(() => getNextCronRun("not-a-cron", new Date())).toThrow(ApiError);
    });
  });

  describe("isValidCron", () => {
    it("validates standard 5-part cron expressions", () => {
      expect(isValidCron("* * * * *")).toBe(true);
      expect(isValidCron("0 0 * * *")).toBe(true);
      expect(isValidCron("30 4 1,15 * *")).toBe(true);
      expect(isValidCron("*/15 9-17 * * 1-5")).toBe(true);
      expect(isValidCron("0 12 * * MON-FRI")).toBe(true);
    });

    it("rejects invalid cron expressions", () => {
      expect(isValidCron("")).toBe(false);
      expect(isValidCron("not-a-cron")).toBe(false);
      expect(isValidCron("60 * * * *")).toBe(false); // invalid minute
      expect(isValidCron("* * * * * * * *")).toBe(false);
      expect(isValidCron(null as unknown as string)).toBe(false);
      expect(isValidCron(undefined as unknown as string)).toBe(false);
    });
  });
});
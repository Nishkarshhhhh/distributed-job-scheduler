import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/apiError";

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      if (parsed.query !== undefined) {
        req.query = parsed.query as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return next(ApiError.badRequest("Validation failed", details));
      }
      next(err);
    }
  };
}
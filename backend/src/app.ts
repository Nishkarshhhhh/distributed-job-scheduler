import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./modules/auth/auth.routes";
import jobsRoutes from "./modules/jobs/jobs.routes";
import { swaggerSpec } from "./config/swagger";
import { ApiError } from "./utils/apiError";
import { logger } from "./config/logger";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { globalRateLimiter, authRateLimiter } from "./middleware/rateLimit.middleware";

export function createApp(): Application {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api/auth", authRateLimiter, authRoutes);
  app.use("/api/jobs", jobsRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      if (err.statusCode >= 500) {
        logger.error(err.message, { stack: err.stack, path: req.originalUrl });
      }
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }

    logger.error(err.message, { stack: err.stack, path: req.originalUrl });
    res.status(500).json({ success: false, message: "Internal Server Error" });
  });

  return app;
}
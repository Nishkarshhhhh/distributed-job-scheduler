import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const routesPath = path
  .join(__dirname, "../modules/**/*.routes.{ts,js}")
  .replace(/\\/g, "/");

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Distributed Job Scheduler API",
      version: "1.0.0",
      description: "API for scheduling, managing, and monitoring distributed background jobs.",
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [routesPath],
};

export const swaggerSpec = swaggerJsdoc(options);
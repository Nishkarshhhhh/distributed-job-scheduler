process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://scheduler:scheduler_dev_pw@localhost:5432/job_scheduler?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-32-chars-long";
process.env.REDIS_HOST = process.env.REDIS_HOST || "localhost";
process.env.REDIS_PORT = process.env.REDIS_PORT || "6379";

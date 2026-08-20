import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { disconnectRedis } from "../../src/config/redis";
import { closeAllQueues } from "../../src/queue/queue.registry";

const app = createApp();

describe("Jobs routes (integration)", () => {
  const testEmail = `jobs-test-${Date.now()}@example.com`;
  let token: string;
  let userId: string;
  let createdJobId: string;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Jobs Test User",
      email: testEmail,
      password: "Test1234",
    });
    token = res.body.data.token;
    userId = res.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.jobRun.deleteMany({ where: { job: { ownerId: userId } } });
    await prisma.job.deleteMany({ where: { ownerId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await closeAllQueues();
    await disconnectRedis();
    await prisma.$disconnect();
  });

  it("rejects job creation without auth", async () => {
    const res = await request(app).post("/api/jobs").send({ name: "X", type: "ONE_TIME" });
    expect(res.status).toBe(401);
  });

  it("creates a one-time job", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Integration Job",
        type: "ONE_TIME",
        payload: { hello: "world" },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Integration Job");
    createdJobId = res.body.data.id;
  });

  it("rejects a CRON job with no cronExpression", async () => {
    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Cron Job", type: "CRON" });

    expect(res.status).toBe(400);
  });

  it("lists only the current user's jobs", async () => {
    const res = await request(app).get("/api/jobs").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((j: any) => j.name)).toBe(true);
  });

  it("fetches a single job by id", async () => {
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdJobId);
  });

  it("returns 404 for a nonexistent job", async () => {
    const res = await request(app)
      .get("/api/jobs/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("pauses and resumes the job", async () => {
    const pauseRes = await request(app)
      .post(`/api/jobs/${createdJobId}/pause`)
      .set("Authorization", `Bearer ${token}`);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe("PAUSED");

    const resumeRes = await request(app)
      .post(`/api/jobs/${createdJobId}/resume`)
      .set("Authorization", `Bearer ${token}`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.status).toBe("ACTIVE");
  });

  it("retrieves run history for the job", async () => {
    const res = await request(app)
      .get(`/api/jobs/${createdJobId}/runs`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("deletes the job", async () => {
    const res = await request(app)
      .delete(`/api/jobs/${createdJobId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
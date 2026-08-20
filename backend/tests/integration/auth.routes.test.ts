import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";

const app = createApp();

describe("Auth routes (integration)", () => {
  const testEmail = `test-${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Integration Test User",
      email: testEmail,
      password: "Test1234",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Integration Test User",
      email: testEmail,
      password: "Test1234",
    });

    expect(res.status).toBe(409);
  });

  it("rejects registration with a weak password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Weak Password User",
      email: `weak-${Date.now()}@example.com`,
      password: "weak",
    });

    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: testEmail,
      password: "Test1234",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it("rejects login with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: testEmail,
      password: "WrongPassword",
    });

    expect(res.status).toBe(401);
  });

  it("returns the current user profile with a valid token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: testEmail,
      password: "Test1234",
    });

    const token = loginRes.body.data.token;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testEmail);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
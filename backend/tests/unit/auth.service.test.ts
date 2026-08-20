import { registerUser, loginUser } from "../../src/modules/auth/auth.service";
import { prisma } from "../../src/config/prisma";
import { ApiError } from "../../src/utils/apiError";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};

describe("auth.service", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    it("creates a new user and returns a token", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
        passwordHash: "hashed",
      });

      const result = await registerUser({
        name: "Test User",
        email: "test@example.com",
        password: "Test1234",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toEqual(expect.any(String));
      expect(mockedPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it("throws a conflict error if the email is already registered", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        registerUser({ name: "Test", email: "test@example.com", password: "Test1234" })
      ).rejects.toThrow(ApiError);
    });
  });

  describe("loginUser", () => {
    it("throws unauthorized for a non-existent user", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        loginUser({ email: "nobody@example.com", password: "whatever" })
      ).rejects.toThrow(ApiError);
    });

    it("throws unauthorized for a wrong password", async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        isActive: true,
        passwordHash: "$2b$12$abcdefghijklmnopqrstuvwx", // not a real match
        role: "USER",
      });

      await expect(
        loginUser({ email: "test@example.com", password: "WrongPassword" })
      ).rejects.toThrow(ApiError);
    });
  });
});
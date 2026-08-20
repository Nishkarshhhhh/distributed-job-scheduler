import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/apiError";
import { hashPassword, comparePassword } from "../../utils/password";
import { signAccessToken } from "../../utils/jwt";
import { RegisterInput, LoginInput } from "./auth.validation";
import { Role } from "@prisma/client";

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  token: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.USER,
    },
  });

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated");
  }

  const isMatch = await comparePassword(input.password, user.passwordHash);

  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
}
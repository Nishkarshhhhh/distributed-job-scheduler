import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { ApiError } from "../utils/apiError";
import { prisma } from "../config/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed Authorization header");
    }

    const token = header.split(" ")[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized("User no longer exists or is inactive");
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
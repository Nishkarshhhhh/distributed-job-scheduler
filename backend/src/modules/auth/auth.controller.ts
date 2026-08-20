import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerUser, loginUser, getUserProfile } from "./auth.service";
import { ApiError } from "../../utils/apiError";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  res.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);
  res.status(200).json({ success: true, data: result });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await getUserProfile(req.user.sub);
  res.status(200).json({ success: true, data: profile });
});
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import * as jobsService from "./jobs.service";

function requireUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.sub, role: req.user.role };
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await jobsService.createJob(req.body, user.id);
  res.status(201).json({ success: true, data: job });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 20;
  const status = req.query.status as jobsService.ListJobsQuery["status"];
  const type = req.query.type as jobsService.ListJobsQuery["type"];
  const result = await jobsService.listJobs({ page, limit, status, type }, user);
  res.status(200).json({ success: true, ...result });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await jobsService.getJobById(req.params.id, user);
  res.status(200).json({ success: true, data: job });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await jobsService.updateJob(req.params.id, req.body, user);
  res.status(200).json({ success: true, data: job });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  await jobsService.deleteJob(req.params.id, user);
  res.status(204).send();
});

export const trigger = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const jobRun = await jobsService.triggerJobNow(req.params.id, user);
  res.status(202).json({ success: true, data: jobRun });
});

export const pause = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await jobsService.pauseJob(req.params.id, user);
  res.status(200).json({ success: true, data: job });
});

export const resume = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const job = await jobsService.resumeJob(req.params.id, user);
  res.status(200).json({ success: true, data: job });
});

export const runs = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const jobRuns = await jobsService.getJobRuns(req.params.id, user);
  res.status(200).json({ success: true, data: jobRuns });
});

export const cancelRun = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const result = await jobsService.cancelLatestRun(req.params.id, user);
  res.status(200).json({ success: true, data: result });
});
import { apiClient } from "./client";
import { Job, JobRun, PaginatedJobs, CreateJobInput } from "@/types";

export async function fetchJobs(params?: {
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedJobs> {
  const res = await apiClient.get<PaginatedJobs>("/jobs", { params });
  return res.data;
}

export async function fetchJob(id: string): Promise<{ success: boolean; data: Job }> {
  const res = await apiClient.get(`/jobs/${id}`);
  return res.data;
}

export async function createJob(input: CreateJobInput): Promise<{ success: boolean; data: Job }> {
  const res = await apiClient.post("/jobs", input);
  return res.data;
}

export async function deleteJob(id: string): Promise<void> {
  await apiClient.delete(`/jobs/${id}`);
}

export async function triggerJob(id: string): Promise<{ success: boolean; data: JobRun }> {
  const res = await apiClient.post(`/jobs/${id}/trigger`);
  return res.data;
}

export async function pauseJob(id: string): Promise<{ success: boolean; data: Job }> {
  const res = await apiClient.post(`/jobs/${id}/pause`);
  return res.data;
}

export async function resumeJob(id: string): Promise<{ success: boolean; data: Job }> {
  const res = await apiClient.post(`/jobs/${id}/resume`);
  return res.data;
}

export async function fetchJobRuns(id: string): Promise<{ success: boolean; data: JobRun[] }> {
  const res = await apiClient.get(`/jobs/${id}/runs`);
  return res.data;
}
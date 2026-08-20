import { apiClient } from "./client";
import { AuthResponse } from "@/types";

export async function registerRequest(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/register", input);
  return res.data;
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/login", input);
  return res.data;
}

export async function getMeRequest() {
  const res = await apiClient.get("/auth/me");
  return res.data;
}
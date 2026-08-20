import { JobExecutionType } from "@prisma/client";
import { IJobExecutor } from "./executor.interface";
import { HttpExecutor } from "./http.executor";

const httpExecutor = new HttpExecutor();

export function getJobExecutor(executionType: JobExecutionType = JobExecutionType.HTTP): IJobExecutor {
  switch (executionType) {
    case JobExecutionType.HTTP:
      return httpExecutor;
    default:
      return httpExecutor;
  }
}

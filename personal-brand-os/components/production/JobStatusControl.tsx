"use client";

import { StatusSelect } from "@/components/ui/StatusSelect";
import { updateProductionJobField } from "@/lib/actions/production";
import { PRODUCTION_JOB_STATUS } from "@/lib/status";

export function JobStatusControl({ clientId, jobId, status }: { clientId: string; jobId: string; status: string }) {
  return (
    <StatusSelect
      value={status}
      options={PRODUCTION_JOB_STATUS}
      ariaLabel="Production day status"
      onChange={(value) => updateProductionJobField(clientId, jobId, "status", value)}
    />
  );
}

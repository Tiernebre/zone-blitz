import type { HealthStatus } from "../../types/health.ts";

export interface HealthService {
  check(): Promise<HealthStatus>;
}

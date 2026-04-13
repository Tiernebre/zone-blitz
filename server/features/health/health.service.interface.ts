import type { HealthStatus } from "@zone-blitz/shared";

export interface HealthService {
  check(): Promise<HealthStatus>;
}

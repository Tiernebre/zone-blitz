export interface HealthStatus {
  status: "ok" | "error";
  commit: string;
}

export interface HealthService {
  check(): Promise<HealthStatus>;
}

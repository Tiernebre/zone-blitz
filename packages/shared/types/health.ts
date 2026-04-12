export interface HealthStatus {
  status: "ok" | "error";
  commit: string;
}

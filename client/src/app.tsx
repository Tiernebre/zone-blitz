import { useEffect, useState } from "react";

export function App() {
  const [health, setHealth] = useState<
    {
      status: string;
      commit: string;
    } | null
  >(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Zone Blitz</h1>
        <p className="text-lg text-gray-400 max-w-md mx-auto">
          Football franchise simulation. Scout, draft, trade, and build your
          dynasty.
        </p>
        {health && (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <span
              className={`size-2 rounded-full ${
                health.status === "ok" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span>
              {health.status === "ok" ? "Connected" : "Disconnected"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

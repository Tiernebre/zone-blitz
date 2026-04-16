import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createAppRouter } from "./router.tsx";
import "./index.css";

const queryClient = new QueryClient();
const router = createAppRouter();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delay={700}>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);

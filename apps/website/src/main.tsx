import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import { trpc, trpcClient } from "./trpc.js";
import "./theme.css";
import "./style.css";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => console.error("Query failed", err),
  }),
});

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);

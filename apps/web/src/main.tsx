import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { PrefsProvider } from "./lib/prefs";
import "./lib/i18n";
import "./index.css";

declare const __SPA_BUILD__: string;

// Boot marker — F12 → Console to verify the browser is running the
// freshly built bundle vs. a cached older one. The value is injected
// by Vite at build time; see apps/web/vite.config.ts.
// eslint-disable-next-line no-console
console.log("[REHAU SPA] build", __SPA_BUILD__);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <PrefsProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <Toaster
            position="bottom-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                fontFamily: "var(--mono)",
                fontSize: "0.75rem",
              },
            }}
            offset={88}
          />
        </AuthProvider>
      </QueryClientProvider>
    </PrefsProvider>
  </StrictMode>,
);

"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/overlays";
import { Toaster } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";

/** A 401 that survived the BFF's refresh attempt means the session is gone:
 * send the user to sign in, preserving where they were. */
function handleUnauthorized(error: unknown): void {
  if (error instanceof ApiError && error.isUnauthorized && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign(`/login?next=${next}`);
    }
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleUnauthorized }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Client errors are deterministic — never retry them.
          if (error instanceof ApiError && error.status > 0 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

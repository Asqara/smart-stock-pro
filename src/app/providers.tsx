"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { useState } from "react";

type ProvidersProps = {
  children: React.ReactNode;
};

/**
 * Root client providers: React Query, Jotai, Helmet.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </JotaiProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

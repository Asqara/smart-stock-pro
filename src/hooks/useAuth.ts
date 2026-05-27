"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { eden } from "@/lib/eden";

type EdenErrorLike = {
  status?: number;
  value?: {
    code?: string;
    message?: string;
  };
};

/**
 * Check whether an API error represents an expired or invalid session.
 */
export function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as EdenErrorLike;

  return value.status === 401 || value.value?.code === "UNAUTHORIZED";
}

/**
 * Query current authenticated user.
 */
export function useAuth() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.auth.me.get();

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    queryKey: ["auth", "me"],
    retry: (failureCount, error) =>
      !isUnauthorizedError(error) && failureCount < 1,
    staleTime: 30_000,
  });
}

/**
 * Logout mutation that clears auth cache.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await eden.api.v1.auth.logout.post({});

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.clear();
    },
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ["auth"] });
    },
  });
}

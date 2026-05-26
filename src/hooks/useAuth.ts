"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { eden } from "@/lib/eden";

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
    retry: false,
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
  });
}

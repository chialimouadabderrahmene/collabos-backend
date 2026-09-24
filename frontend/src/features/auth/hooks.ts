"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi, type Credentials } from "@/lib/api/auth";
import { queryKeys } from "@/lib/api/query-keys";

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: authApi.me,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Credentials) => authApi.login(input),
    onSuccess: async () => {
      // Session changed: drop everything cached for a previous user.
      client.clear();
    },
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Credentials) => authApi.register(input),
    onSuccess: () => client.clear(),
  });
}

export function useLogout() {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      client.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}

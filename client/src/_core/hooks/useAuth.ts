import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};

  const { isLoaded, userId } = useClerkAuth();
  const clerk = useClerk();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isLoaded && Boolean(userId),
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Ignore already-logged-out state from API.
      } else {
        throw error;
      }
    } finally {
      await clerk.signOut({ redirectUrl: getLoginUrl() });
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils, clerk]);

  const state = useMemo(() => {
    const loading =
      !isLoaded || (Boolean(userId) && meQuery.isLoading) || logoutMutation.isPending;
    const user = userId ? meQuery.data ?? null : null;
    const error = meQuery.error ?? logoutMutation.error ?? null;
    const isAuthenticated = Boolean(userId && user);

    localStorage.setItem("runtime-user-info", JSON.stringify(user));

    return {
      user,
      loading,
      error,
      isAuthenticated,
    };
  }, [
    isLoaded,
    userId,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

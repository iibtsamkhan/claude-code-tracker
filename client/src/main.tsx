import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { ClerkProvider } from "@clerk/react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { assertNoThirdPartyEgress } from "./lib/networkPolicy";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        assertNoThirdPartyEgress(requestUrl, window.location.origin);

        const headers = new Headers(init?.headers ?? {});
        const clerk = (window as any).Clerk;
        const sessionToken = await clerk?.session?.getToken?.();
        if (sessionToken) {
          headers.set("Authorization", `Bearer ${sessionToken}`);
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!clerkPublishableKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={clerkPublishableKey}
    signInUrl={import.meta.env.VITE_CLERK_SIGN_IN_URL || "/sign-in"}
    signUpUrl={import.meta.env.VITE_CLERK_SIGN_UP_URL || "/sign-up"}
    afterSignOutUrl="/"
  >
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ClerkProvider>
);

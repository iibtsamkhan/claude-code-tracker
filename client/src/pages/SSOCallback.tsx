import { AuthenticateWithRedirectCallback } from "@clerk/react";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}

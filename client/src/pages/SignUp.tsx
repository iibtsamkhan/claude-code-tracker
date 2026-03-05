import { SignUp } from "@clerk/react";
import { getLoginUrl } from "@/const";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl={getLoginUrl()}
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}

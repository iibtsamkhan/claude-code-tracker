import { SignIn } from "@clerk/react";
import { getSignUpUrl } from "@/const";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl={getSignUpUrl()}
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}

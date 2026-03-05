import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "./lib/lazyWithRetry";

const Home = lazyWithRetry(() => import("./pages/Home"), "home");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "dashboard");
const Settings = lazyWithRetry(() => import("./pages/Settings"), "settings");
const SignInPage = lazyWithRetry(() => import("./pages/SignIn"), "sign-in");
const SignUpPage = lazyWithRetry(() => import("./pages/SignUp"), "sign-up");
const SSOCallbackPage = lazyWithRetry(() => import("./pages/SSOCallback"), "sso-callback");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "not-found");

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={40} />
    </div>
  );
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Switch>
        <Route path="/" component={isAuthenticated ? Dashboard : Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/sso-callback" component={SSOCallbackPage} />
        <Route path="/sign-in/sso-callback" component={SSOCallbackPage} />
        <Route path="/sign-up/sso-callback" component={SSOCallbackPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

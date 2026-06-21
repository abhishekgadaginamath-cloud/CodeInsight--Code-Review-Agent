import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import type { LocalizationResource } from "@clerk/types";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AnalyzePage from "@/pages/analyze";
import ProcessingPage from "@/pages/processing";
import ReviewPage from "@/pages/review";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk" as const,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
    socialButtonsPlacement: "bottom" as const,
  },
  variables: {
    colorPrimary: "#8b5cf6",
    colorForeground: "#f1f5f9",
    colorMutedForeground: "#64748b",
    colorDanger: "#ef4444",
    colorBackground: "#080c15",
    colorInput: "#111827",
    colorInputForeground: "#f1f5f9",
    colorNeutral: "#1e293b",
    fontFamily: "'Space Grotesk', sans-serif",
    borderRadius: "0.6rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#080c15] border border-purple-500/20 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-purple-900/30",
    card: "!bg-transparent",
    footer: "!bg-transparent",
    headerTitle: "text-white font-semibold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButton: "bg-[#111827] border border-white/10 text-white hover:bg-white/5",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-slate-300",
    formFieldInput: "bg-[#111827] border-white/10 text-white placeholder:text-slate-500",
    footerActionText: "text-slate-400",
    footerActionLink: "text-purple-400 hover:text-purple-300",
    dividerText: "text-slate-500",
    identityPreviewText: "text-slate-300",
    identityPreviewEditButtonIcon: "text-purple-400",
    formButtonPrimary: "bg-purple-600 hover:bg-purple-500 text-white",
    otpCodeFieldInput: "bg-[#111827] border-white/10 text-white",
    logoImage: "rounded-full shadow-[0_0_24px_6px_rgba(139,92,246,0.55)]",
  },
};

const clerkLocalization: Partial<LocalizationResource> = {
  signIn: {
    start: {
      title: "Sign in to CodeInsight",
      subtitle: "Welcome back",
      actionText: "",
      actionLink: "",
      actionLink__use_email: "",
      actionLink__use_phone: "",
      actionLink__use_username: "",
    },
  } as LocalizationResource["signIn"],
  signUp: {
    start: {
      title: "Create your CodeInsight account",
      subtitle: "Get started for free",
      actionText: "",
      actionLink: "",
    },
  } as LocalizationResource["signUp"],
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?">
        <div className="min-h-screen bg-background flex items-center justify-center bg-grid">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-transparent to-blue-950/20 pointer-events-none" />
          <SignIn
            path={`${basePath}/sign-in`}
            routing="path"
            appearance={clerkAppearance}
            fallbackRedirectUrl={`${basePath}/dashboard`}
          />
        </div>
      </Route>
      <Route path="/sign-up/*?">
        <div className="min-h-screen bg-background flex items-center justify-center bg-grid">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-transparent to-blue-950/20 pointer-events-none" />
          <SignUp
            path={`${basePath}/sign-up`}
            routing="path"
            appearance={clerkAppearance}
            fallbackRedirectUrl={`${basePath}/dashboard`}
          />
        </div>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/analyze">
        <ProtectedRoute><AnalyzePage /></ProtectedRoute>
      </Route>
      <Route path="/reviews/:id/processing">
        {(params) => (
          <ProtectedRoute><ProcessingPage id={params.id} /></ProtectedRoute>
        )}
      </Route>
      <Route path="/reviews/:id">
        {(params) => (
          <ProtectedRoute><ReviewPage id={params.id} /></ProtectedRoute>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen bg-[#080c15] flex items-center justify-center text-white">
        Missing Clerk publishable key
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      routerPush={(to) => window.history.pushState(null, "", to)}
      routerReplace={(to) => window.history.replaceState(null, "", to)}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={`${basePath}/`}
      localization={clerkLocalization as LocalizationResource}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;

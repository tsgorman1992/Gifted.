import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Pages
import LandingPage from "@/pages/landing";
import CreatePage from "@/pages/create";
import PreviewPage from "@/pages/preview";
import RevealPage from "@/pages/reveal";
import OpenPage from "@/pages/open";
import RedeemPage from "@/pages/redeem";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/create" component={CreatePage} />
        <Route path="/preview" component={PreviewPage} />
        <Route path="/reveal" component={RevealPage} />
        <Route path="/open/:id" component={OpenPage} />
        <Route path="/redeem" component={RedeemPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

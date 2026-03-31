import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";

// Redirect /reveal?giftId=xxx → /open/xxx so auto-save and account-linking run correctly
function RevealRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const giftId = new URLSearchParams(window.location.search).get("giftId");
    if (giftId) {
      setLocation(`/open/${giftId}`, { replace: true });
    }
  }, [setLocation]);
  return null;
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [path] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); }, [path]);
  return null;
}

import LandingPage  from "@/pages/landing";
import CreatePage   from "@/pages/create";
import PreviewPage  from "@/pages/preview";
import OpenPage     from "@/pages/open";
import RedeemPage   from "@/pages/redeem";
import FaqPage      from "@/pages/faq";
import TermsPage    from "@/pages/terms";
import PrivacyPage  from "@/pages/privacy";
import ContactPage  from "@/pages/contact";
import MyGiftsPage  from "@/pages/my-gifts";
import SignInPage   from "@/pages/sign-in";
import AdminPage      from "@/pages/admin";
import SmsConsentPage from "@/pages/sms-consent";
import AccountPage    from "@/pages/account";
import FeaturesPage   from "@/pages/features";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <Switch>
        <Route path="/"          component={LandingPage}  />
        <Route path="/create"    component={CreatePage}   />
        <Route path="/preview"   component={PreviewPage}  />
        <Route path="/reveal"    component={RevealRedirect} />
        <Route path="/open/:id"  component={OpenPage}     />
        <Route path="/redeem"    component={RedeemPage}   />
        <Route path="/faq"       component={FaqPage}      />
        <Route path="/help"      component={FaqPage}      />
        <Route path="/terms"     component={TermsPage}    />
        <Route path="/privacy"   component={PrivacyPage}  />
        <Route path="/contact"   component={ContactPage}  />
        <Route path="/my-gifts"  component={MyGiftsPage}  />
        <Route path="/sign-in"   component={SignInPage}   />
        <Route path="/admin"       component={AdminPage}      />
        <Route path="/sms-consent" component={SmsConsentPage} />
        <Route path="/account"     component={AccountPage}    />
        <Route path="/features"    component={FeaturesPage}   />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

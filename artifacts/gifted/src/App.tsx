import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";

// Redirect /reveal?giftId=xxx → /open/xxx so auto-save and account-linking run correctly.
// Preserve preview=true and embed=true so open.tsx can suppress overlays in iframe previews.
function RevealRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const giftId = params.get("giftId");
    if (giftId) {
      const qs = new URLSearchParams();
      if (params.get("preview") === "true") qs.set("preview", "true");
      if (params.get("embed") === "true") qs.set("embed", "true");
      const qsStr = qs.toString();
      setLocation(`/open/${giftId}${qsStr ? `?${qsStr}` : ""}`, { replace: true });
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
import FeaturesPage    from "@/pages/features";
import AddOccasionPage from "@/pages/add-occasion";
import SendPage        from "@/pages/send";
import ChipInPage          from "@/pages/chip-in";
import ChipInStatusPage    from "@/pages/chip-in-status";
import ChipInDashboardPage from "@/pages/chip-in-dashboard";
import ChipInCreatePage    from "@/pages/chip-in-create";

const queryClient = new QueryClient();

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

function GlobalClaimOnLogin() {
  const { isAuthenticated, isLoading } = useAuth();
  const qc = useQueryClient();
  const claimedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || claimedRef.current) return;
    const giftId = localStorage.getItem("gifted_gift_id");
    if (!giftId) {
      qc.invalidateQueries({ queryKey: ["my-gifts"] });
      claimedRef.current = true;
      return;
    }
    fetch(`${BASE}/api/gifted/gifts/${giftId}/claim`, {
      method: "PATCH",
      credentials: "include",
    })
      .then((res) => {
        if (res.ok || res.status === 409) {
          localStorage.removeItem("gifted_gift_id");
          claimedRef.current = true;
        }
        qc.invalidateQueries({ queryKey: ["my-gifts"] });
      })
      .catch(() => {
        qc.invalidateQueries({ queryKey: ["my-gifts"] });
      });
  }, [isAuthenticated, isLoading, qc]);

  return null;
}

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <GlobalClaimOnLogin />
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
        <Route path="/features"      component={FeaturesPage}    />
        <Route path="/add-occasion" component={AddOccasionPage} />
        <Route path="/send/:id"     component={SendPage}        />
        <Route path="/chip-in/status/:token"    component={ChipInStatusPage}    />
        <Route path="/chip-in/create"           component={ChipInCreatePage}    />
        <Route path="/chip-in/dashboard/:id"    component={ChipInDashboardPage} />
        <Route path="/chip-in/:shareToken"      component={ChipInPage}          />
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

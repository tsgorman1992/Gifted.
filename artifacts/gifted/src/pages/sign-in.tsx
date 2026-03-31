import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const { isAuthenticated, isLoading, refetch } = useAuth();
  const [, setLocation] = useLocation();

  const [mode, setMode]               = useState<Mode>("sign-in");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [googleOnly, setGoogleOnly]   = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/auth/google/enabled`, { credentials: "include" })
      .then(r => r.json()).then(d => setGoogleEnabled(!!d.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) setLocation("/my-gifts");
  }, [isAuthenticated, isLoading, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const endpoint = mode === "sign-in" ? "/api/auth/login" : "/api/auth/register";
    const body: Record<string, string> = { email, password };
    if (mode === "sign-up") { body.firstName = firstName; body.lastName = lastName; }
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "__GOOGLE_ACCOUNT__") {
          setGoogleOnly(true);
          setError(null);
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }
      await refetch();
      setLocation("/my-gifts");
    } catch {
      setError("Unable to connect. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-3">
          <a href="/" className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-70 transition-opacity">
            gifted.
          </a>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-medium mb-2">
            {mode === "sign-in" ? "Welcome back." : "Create an account."}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            {mode === "sign-in"
              ? "Sign in to track your moments and create new ones."
              : "Start sending moments people won't forget."}
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-5">
          {googleEnabled && (
            <>
              <button
                type="button"
                onClick={() => { window.location.href = `${BASE}/api/auth/google`; }}
                className="w-full h-12 flex items-center justify-center gap-3 rounded-full border border-border hover:bg-secondary/60 transition-colors font-medium text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2528 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8586-3.0477.8586-2.3446 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
                  <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6554 3.5795 9 3.5795z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-widest">or</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {mode === "sign-up" && (
                <motion.div
                  key="name-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">First name</label>
                      <input
                        type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Last name</label>
                      <input
                        type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                        placeholder="Johnson"
                        className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setGoogleOnly(false); setError(null); }}
                placeholder="you@example.com" required autoComplete="email"
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "sign-up" ? "Min. 8 characters" : "Your password"}
                  required autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {googleOnly && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center space-y-3">
                <p className="text-sm font-medium text-amber-900">This account uses Google Sign-In</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {googleEnabled
                    ? "Use the Google button above to sign in — no password needed."
                    : "This account was created with Google. To sign in, visit gifted.page where Google Sign-In is available."}
                </p>
                {googleEnabled && (
                  <button
                    type="button"
                    onClick={() => { window.location.href = `${BASE}/api/auth/google`; }}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-50 transition-colors shadow-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2528 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8586-3.0477.8586-2.3446 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
                      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6554 3.5795 9 3.5795z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </button>
                )}
              </motion.div>
            )}

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 text-center">{error}</motion.p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 rounded-full text-base shadow-md">
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); setGoogleOnly(false); }}
              className="text-primary font-medium hover:underline">
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

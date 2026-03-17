import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { Gift } from "lucide-react";

export default function SignInPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/my-gifts");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md text-center"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
          <Gift className="w-10 h-10 text-primary" />
        </div>

        <h1 className="font-serif text-5xl font-medium mb-4">Welcome back.</h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Sign in to track your sent gifts, see when they've been opened, and create new moments.
        </p>

        <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
          <Button
            size="lg"
            className="w-full h-14 rounded-full text-base shadow-lg"
            onClick={login}
            disabled={isLoading}
          >
            {isLoading ? "Loading…" : "Continue to gifted."}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            By signing in, you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

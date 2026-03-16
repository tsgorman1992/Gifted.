import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isReveal = location === "/reveal";

  // Hide standard nav on the reveal page for maximum immersion
  if (isReveal) {
    return <main className="min-h-screen w-full bg-background selection:bg-primary/20">{children}</main>;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full glass-panel border-b-0 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity">
            gifted.
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block transition-colors">
              Sign in
            </Link>
            <Link href="/create">
              <Button className="rounded-full px-6 shadow-md hover:-translate-y-0.5 transition-transform duration-300">
                Send a gift
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full">{children}</main>
      <footer className="w-full bg-secondary/50 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="font-serif text-2xl font-bold">gifted.</span>
            <span className="text-sm text-muted-foreground">Personal in the moment. Flexible in the end.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

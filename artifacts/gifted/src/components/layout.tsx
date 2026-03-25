import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Gift, LogOut, ChevronDown } from "lucide-react";
import { clearGiftSession } from "@/lib/session";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  function handleSendGift() {
    clearGiftSession();
    setLocation("/create");
  }

  function handleLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    clearGiftSession();
    setLocation("/");
  }
  const isReveal = location === "/reveal" || location.startsWith("/open/") || location === "/redeem";

  if (isReveal) {
    return <main className="min-h-screen w-full bg-background selection:bg-primary/20">{children}</main>;
  }

  const displayName = user?.firstName || user?.email?.split("@")[0] || "Account";

  return (
    <div className="min-h-screen w-full flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full glass-panel border-b-0 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" onClick={handleLogoClick} className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
            gifted.
          </a>
          <nav className="flex items-center gap-4">
            {!isLoading && (
              isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <span className="hidden sm:block">{displayName}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                    <DropdownMenuItem asChild>
                      <Link href="/my-gifts" className="flex items-center gap-2 cursor-pointer">
                        <Gift className="w-4 h-4" />
                        My Gifts
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/sign-in"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
              )
            )}
            <Button onClick={handleSendGift} className="rounded-full px-6 shadow-md hover:-translate-y-0.5 transition-transform duration-300">
              Build a moment
            </Button>
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
            <Link href="/terms"    className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy"  className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/faq"      className="hover:text-foreground transition-colors">FAQ</Link>
            <Link href="/contact"  className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

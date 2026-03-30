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
import { User, Gift, LogOut, ChevronDown, Settings, Users } from "lucide-react";
import { clearGiftSession } from "@/lib/session";
import { NotificationBell } from "@/components/notification-bell";

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
          <nav className="flex items-center gap-3">
            {/* Features link — always visible on sm+ */}
            <Link
              href="/features"
              className={`hidden sm:block text-sm font-medium transition-colors px-3 py-1.5 rounded-full hover:bg-secondary ${location === "/features" ? "text-foreground bg-secondary" : "text-muted-foreground"}`}
            >
              Features
            </Link>

            {!isLoading && (
              isAuthenticated && user ? (
                <>
                  <Link
                    href="/my-gifts"
                    className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1.5 rounded-full hover:bg-secondary ${location === "/my-gifts" ? "text-foreground bg-secondary" : "text-muted-foreground"}`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    My Gifts
                  </Link>
                  <NotificationBell />
                  <button
                    aria-label="Contacts"
                    onClick={() => setLocation("/my-gifts?tab=contacts")}
                    className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full">
                        {user.profileImageUrl ? (
                          <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                      <DropdownMenuItem asChild>
                        <Link href="/my-gifts" className="flex items-center gap-2 cursor-pointer sm:hidden">
                          <Gift className="w-4 h-4" />
                          My Gifts
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/features" className="flex items-center gap-2 cursor-pointer sm:hidden">
                          Features
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="w-4 h-4" />
                          Account settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
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
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col items-start gap-2">
            <span className="font-serif text-2xl font-bold">gifted.</span>
            <span className="text-sm text-muted-foreground">Personal in the moment. Flexible in the end.</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Explore</p>
              <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link href="/faq"      className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/contact"  className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Legal</p>
              <Link href="/terms"   className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

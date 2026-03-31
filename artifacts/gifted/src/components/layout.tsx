import React, { useRef, useState } from "react";
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
import { Gift, LogOut, ChevronDown, Settings, Users, Camera, Check, Loader2 } from "lucide-react";
import { clearGiftSession } from "@/lib/session";
import { NotificationBell } from "@/components/notification-bell";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout, refetch } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");

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
  const initials = user?.firstName
    ? user.firstName[0].toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Photo must be under 5 MB.");
      return;
    }

    setUploadState("uploading");
    try {
      // 1. Request presigned upload URL
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });
      if (!reqRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await reqRes.json() as { uploadURL: string; objectPath: string };

      // 2. Upload the file directly
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // 3. Save the profile image URL
      const profileImageUrl = `${BASE}/api/storage${objectPath}`;
      const profileRes = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ profileImageUrl }),
      });
      if (!profileRes.ok) throw new Error("Could not save photo");

      // 4. Refresh auth context so avatar updates everywhere
      await refetch();
      setUploadState("done");
      setTimeout(() => setUploadState("idle"), 2500);
    } catch (err) {
      console.error("Photo upload failed:", err);
      setUploadState("idle");
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full glass-panel border-b-0 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" onClick={handleLogoClick} className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
            gifted.
          </a>

          <nav className="flex items-center gap-3">
            {/* Features — always show on desktop; on mobile only show when NOT signed in (signed-in users get it in the dropdown) */}
            <Link
              href="/features"
              className={`${isAuthenticated ? "hidden sm:block" : "block"} text-sm font-medium transition-colors px-3 py-1.5 rounded-full hover:bg-secondary ${location === "/features" ? "text-foreground bg-secondary" : "text-muted-foreground"}`}
            >
              Features
            </Link>

            {!isLoading && (
              isAuthenticated && user ? (
                <>
                  {/* My Gifts — desktop only */}
                  <Link
                    href="/my-gifts"
                    className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors px-3 py-1.5 rounded-full hover:bg-secondary ${location === "/my-gifts" ? "text-foreground bg-secondary" : "text-muted-foreground"}`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    My Gifts
                  </Link>

                  <NotificationBell />

                  {/* Contacts — desktop only; on mobile it lives in the dropdown */}
                  <button
                    aria-label="Contacts"
                    onClick={() => setLocation("/my-gifts?tab=contacts")}
                    className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                  </button>

                  {/* Profile / account dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-full hover:bg-secondary/50">
                        {user.profileImageUrl ? (
                          <img
                            src={user.profileImageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-border"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                            <span className="text-primary font-bold text-sm leading-none">{initials}</span>
                          </div>
                        )}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                      {/* User identity header */}
                      <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-border mb-1">
                        {user.profileImageUrl ? (
                          <img src={user.profileImageUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-bold text-base leading-none">{initials}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                          {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                        </div>
                      </div>

                      {/* Upload photo */}
                      <DropdownMenuItem
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {uploadState === "uploading" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : uploadState === "done" ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {uploadState === "uploading"
                          ? "Uploading…"
                          : uploadState === "done"
                            ? "Photo saved!"
                            : user.profileImageUrl
                              ? "Change photo"
                              : "Add profile photo"}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Mobile-only nav items */}
                      <DropdownMenuItem asChild>
                        <Link href="/my-gifts" className="flex items-center gap-2 cursor-pointer sm:hidden">
                          <Gift className="w-4 h-4" />
                          My Gifts
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setLocation("/my-gifts?tab=contacts")}
                        className="flex items-center gap-2 cursor-pointer sm:hidden"
                      >
                        <Users className="w-4 h-4" />
                        Contacts
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/features" className="flex items-center gap-2 cursor-pointer sm:hidden">
                          Features
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="sm:hidden" />

                      {/* Always visible */}
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

      {/* Hidden file input for profile photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoSelect}
      />

      <main className="flex-1 w-full">{children}</main>

      <footer className="w-full bg-secondary/50 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="font-serif text-2xl font-bold">gifted.</span>
            <span className="text-sm text-muted-foreground">Personal in the moment. Flexible in the end.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
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

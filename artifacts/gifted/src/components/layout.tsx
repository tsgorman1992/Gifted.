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
import { Gift, LogOut, ChevronDown, Settings, Users, Camera, Check, Loader2, Sparkles } from "lucide-react";
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

    setUploadState("uploading");
    try {
      // Compress if over 1.5 MB — phone cameras produce 8-15 MB photos
      let uploadBlob: Blob = file;
      if (file.size > 1.5 * 1024 * 1024) {
        uploadBlob = await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1200;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
              if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
              else { width = Math.round(width * MAX / height); height = MAX; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
            canvas.toBlob(b => b ? resolve(b) : reject(new Error("Compression failed")), "image/jpeg", 0.85);
          };
          img.onerror = reject;
          img.src = url;
        });
      }

      // 1. Request presigned upload URL
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "profile.jpg",
          size: uploadBlob.size,
          contentType: "image/jpeg",
        }),
      });
      if (!reqRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await reqRes.json() as { uploadURL: string; objectPath: string };

      // 2. Upload the (possibly compressed) blob
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: uploadBlob,
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
                      {/* Tappable avatar header */}
                      <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-border mb-1">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="relative shrink-0 group"
                          title={user.profileImageUrl ? "Change photo" : "Add profile photo"}
                        >
                          {user.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold text-base leading-none">{initials}</span>
                            </div>
                          )}
                          {/* Camera badge */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm group-hover:bg-secondary transition-colors">
                            {uploadState === "uploading" ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />
                            ) : uploadState === "done" ? (
                              <Check className="w-2.5 h-2.5 text-green-600" />
                            ) : (
                              <Camera className="w-2.5 h-2.5 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                          {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {uploadState === "uploading" ? "Uploading…" : uploadState === "done" ? "Photo saved!" : "Tap photo to change"}
                          </p>
                        </div>
                      </div>

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
                          <Sparkles className="w-4 h-4" />
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

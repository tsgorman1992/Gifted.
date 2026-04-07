import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, AlertCircle, Gift, LogIn, Copy, Check, X, ChevronDown, Settings, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { clearGiftSession } from "@/lib/session";

const RevealPage = React.lazy(() => import("@/pages/reveal"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function saveReceivedGift(giftId: string): Promise<"saved" | "already-mine" | "claimed-by-other" | "is-sender"> {
  const res = await fetch(`${BASE}/api/gifted/gifts/${giftId}/save-received`, {
    method: "PATCH",
    credentials: "include",
  });
  if (res.status === 403) {
    return "is-sender";
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.alreadySaved) return "already-mine";
    return "claimed-by-other";
  }
  if (!res.ok) {
    throw new Error(`save-received failed: ${res.status}`);
  }
  const body = await res.json().catch(() => ({}));
  if (body?.alreadySaved) return "already-mine";
  if (body?.isSender) return "is-sender";
  return "saved";
}

export default function OpenPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [giftId, setGiftId] = useState<string | null>(null);
  const [giftSenderUserId, setGiftSenderUserId] = useState<string | null>(null);
  const [giftRecipientUserId, setGiftRecipientUserId] = useState<string | null>(null);
  const [giftOpenedAt, setGiftOpenedAt] = useState<string | null>(null);
  const [giftRecipientName, setGiftRecipientName] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "claimed">("idle");
  const [claimPending, setClaimPending] = useState(false);
  const [senderCopied, setSenderCopied] = useState(false);
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);
  // True when this browser created this gift (guest / not signed-in sender)
  // Detected before the fetch overwrites localStorage, so we can preserve the "preview" state.
  const [isGuestSender, setIsGuestSender] = useState(false);

  useEffect(() => {
    if (!id) {
      setStatus("error");
      setErrorMsg("No gift ID provided");
      return;
    }

    // Detect guest sender: localStorage has this exact gift ID AND the link-shared flag.
    // Both keys are set by preview.tsx after the sender shares the gift link, and cleared
    // when they start a new gift. Check BEFORE the fetch overwrites gifted_gift_id below.
    const storedId = localStorage.getItem("gifted_gift_id");
    const linkShared = localStorage.getItem("gifted_link_shared");
    if (storedId === id && linkShared === "1") {
      setIsGuestSender(true);
    }

    fetch(`${BASE}/api/gifted/gifts/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setStatus("error");
          setErrorMsg(res.status === 404 ? "This moment could not be found" : "Something went wrong loading this moment");
          return;
        }
        const gift = await res.json();

        if (gift.videoPath) localStorage.setItem("gifted_video_path", gift.videoPath);
        else localStorage.removeItem("gifted_video_path");

        if (gift.photoPaths && gift.photoPaths.length > 0) localStorage.setItem("gifted_photo_paths", JSON.stringify(gift.photoPaths));
        else localStorage.removeItem("gifted_photo_paths");

        if (gift.personalNote) localStorage.setItem("gifted_personal_note", gift.personalNote);
        else localStorage.removeItem("gifted_personal_note");

        if (gift.extraLinks && gift.extraLinks.length > 0) {
          localStorage.setItem("gifted_extra_links", JSON.stringify(gift.extraLinks));
          localStorage.removeItem("gifted_playlist_url");
        } else if (gift.playlistUrl) {
          localStorage.setItem("gifted_extra_links", JSON.stringify([gift.playlistUrl]));
          localStorage.removeItem("gifted_playlist_url");
        } else {
          localStorage.removeItem("gifted_extra_links");
          localStorage.removeItem("gifted_playlist_url");
        }

        if (gift.giftTitle) localStorage.setItem("gifted_gift_title", gift.giftTitle);
        else localStorage.removeItem("gifted_gift_title");

        localStorage.setItem("gifted_experience", gift.experience);
        localStorage.setItem("gifted_occasion", gift.occasion);
        localStorage.setItem("gifted_recipient_name", gift.recipientName);
        localStorage.setItem("gifted_sender_name", gift.senderName);

        if (gift.amount && parseFloat(gift.amount) > 0) localStorage.setItem("gifted_amount", gift.amount);
        else localStorage.removeItem("gifted_amount");

        if (gift.intent) localStorage.setItem("gifted_intent", gift.intent);
        else localStorage.removeItem("gifted_intent");

        localStorage.setItem("gifted_gift_id", gift.id);
        localStorage.setItem("gifted_gift_paid", gift.paid ? "true" : "false");

        setGiftId(gift.id);
        setGiftSenderUserId(gift.senderUserId ?? null);
        setGiftRecipientUserId(gift.recipientUserId ?? null);
        setGiftOpenedAt(gift.openedAt ?? null);
        setGiftRecipientName(gift.recipientName ?? "");
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong loading this moment");
      });
  }, [id]);

  // When an authenticated non-sender opens a gift, show a "is this for you?" prompt
  // instead of silently auto-claiming it (prevents the wrong person in a group chat
  // from accidentally locking the gift to their account).
  // Skip prompt if this user is already the confirmed recipient (re-watching).
  useEffect(() => {
    if (!giftId || authLoading || !isAuthenticated) return;
    if (new URLSearchParams(window.location.search).get("preview") === "true") return;
    if (user && giftSenderUserId && user.id === giftSenderUserId) return;
    // Only skip the prompt when this user has genuinely been here before:
    // recipientUserId matches them AND openedAt is set (they've already watched it).
    if (user && giftRecipientUserId && user.id === giftRecipientUserId && giftOpenedAt) {
      setSaveStatus("saved");
      return;
    }
    setClaimPending(true);
  }, [giftId, isAuthenticated, authLoading, user, giftSenderUserId, giftRecipientUserId, giftOpenedAt]);

  async function handleConfirmClaim() {
    if (!giftId) return;
    setClaimPending(false);
    setSaveStatus("saving");
    try {
      const result = await saveReceivedGift(giftId);
      if (result === "claimed-by-other") {
        setSaveStatus("claimed");
      } else if (result === "is-sender") {
        setSaveStatus("idle");
      } else {
        setSaveStatus("saved");
      }
    } catch {
      setSaveStatus("idle");
    }
  }

  function handleDeclineClaim() {
    setClaimPending(false);
  }

  function handleRevealComplete() {
    setRevealed(true);
  }

  // Delay bar appearance slightly so it doesn't pop in mid-reveal animation
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setBarVisible(true), 700);
    return () => clearTimeout(t);
  }, [revealed]);

  function handleSaveToAccount() {
    if (!giftId) return;
    if (isAuthenticated && user && giftSenderUserId && user.id === giftSenderUserId) return;
    const here = window.location.pathname + window.location.search;
    setLocation(`/sign-in?returnTo=${encodeURIComponent(here)}`);
  }

  if (status === "loading" || (status === "ready" && authLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Opening your moment...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-serif text-3xl mb-3">Moment not found</h1>
        <p className="text-muted-foreground mb-8 max-w-sm">
          {errorMsg}. The link may have expired or been entered incorrectly.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-xl">
            Go to gifted.
          </Button>
        </Link>
      </div>
    );
  }

  // Sender view — shown when the logged-in user is the one who created this gift
  const isSender = !authLoading && isAuthenticated && user && giftSenderUserId && user.id === giftSenderUserId;
  // When coming from the dashboard, the URL has ?preview=true — let the sender through to the full experience
  const isPreviewMode = new URLSearchParams(window.location.search).get("preview") === "true";
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "true";

  const handleSenderCopy = async () => {
    // Always copy the /api/share/:id URL — this is the OG-enabled link
    // that generates the gift-specific preview card in iMessage, WhatsApp, etc.
    // Never copy window.location.href (/open/:id) — that's the React SPA and
    // returns the generic index.html with no gift-specific OG tags.
    const shareUrl = `${window.location.origin}${BASE}/api/share/${giftId}`;
    await navigator.clipboard.writeText(shareUrl);
    setSenderCopied(true);
    setTimeout(() => setSenderCopied(false), 2000);
  };

  // Only block with the info screen when NOT in preview mode (e.g. raw direct link, link unfurl)
  if (isSender && !isPreviewMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Gift className="w-9 h-9 text-primary" />
        </div>
        <h1 className="font-serif text-3xl mb-3">Your moment for {giftRecipientName}</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Share the link below when you're ready. <span className="font-medium text-foreground">{giftRecipientName}</span> will see the full surprise when they open it.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={handleSenderCopy}
            className="w-full rounded-xl gap-2"
          >
            {senderCopied ? (
              <><Check className="w-4 h-4" /> Copied!</>
            ) : (
              <><Copy className="w-4 h-4" /> Copy link</>
            )}
          </Button>
          <div className="flex gap-3">
            <Link href="/my-gifts" className="flex-1">
              <Button variant="outline" className="rounded-xl w-full">
                Your moments
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="rounded-xl w-full">
                Go home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.firstName || user?.email?.split("@")[0] || "Account";
  const initials = user?.firstName
    ? user.firstName[0].toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  return (
    <>
      {/* ── Post-reveal top bar ────────────────────────────────────────────
          Fades in after the moment is fully revealed. Minimal glass bar
          with brand wordmark + user actions. Hidden during the reveal.
          Suppressed entirely in embed mode (preview iframes). */}
      {!isEmbed && <div
        className={`fixed top-0 left-0 right-0 z-50 px-4 pt-3 transition-all duration-700 ease-out ${
          barVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-12 rounded-2xl bg-background/80 backdrop-blur-md border border-border/40 shadow-sm">
          {/* Brand */}
          <Link
            href="/"
            className="font-serif text-lg font-bold text-foreground/70 hover:text-foreground transition-colors"
          >
            gifted.
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {!authLoading && isAuthenticated && user ? (
              <>
                {/* My Gifts — text link, desktop only */}
                <Link
                  href="/my-gifts"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full hover:bg-secondary"
                >
                  <Gift className="w-3 h-3" />
                  My Gifts
                </Link>

                {/* Avatar dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-1 py-1 rounded-full hover:bg-secondary/50">
                      {user.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-border">
                          <span className="text-primary font-bold text-xs leading-none">{initials}</span>
                        </div>
                      )}
                      <ChevronDown className="w-3 h-3 opacity-40" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                      {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                    </div>

                    <DropdownMenuItem asChild>
                      <Link href="/my-gifts" className="flex items-center gap-2 cursor-pointer">
                        <Gift className="w-4 h-4" />
                        My Gifts
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => { clearGiftSession(); setLocation("/create"); }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Build a moment
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem asChild>
                      <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                        <Settings className="w-4 h-4" />
                        Account settings
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={logout}
                      className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : !authLoading ? (
              <>
                <Link
                  href={`/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-full hover:bg-secondary"
                >
                  Sign in
                </Link>
                <button
                  onClick={() => { clearGiftSession(); setLocation("/create"); }}
                  className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                >
                  Build a moment
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>}

      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
      >
        <RevealPage onRevealComplete={handleRevealComplete} senderPreview={isGuestSender && !isPreviewMode} />
      </React.Suspense>

      {/* "Is this for you?" confirmation — shown for authenticated non-senders.
          Prevents the wrong person in a group chat from accidentally claiming the gift. */}
      {status === "ready" && claimPending && isAuthenticated && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">
                  This moment is yours, {giftRecipientName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Save it to your account to keep it forever.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmClaim}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Save to my account
              </button>
              <button
                onClick={handleDeclineClaim}
                className="flex-1 h-9 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Just viewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save-to-account prompt — shown as soon as gift loads for signed-out users.
          Intentionally NOT gated on `revealed` — if the user closes the tab before
          finishing the reveal they should have already had a chance to save it.
          Not shown for guest senders previewing their own gift. */}
      {status === "ready" && !authLoading && !isAuthenticated && !isGuestSender && !savePromptDismissed && !isEmbed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Save this moment</p>
              <p className="text-xs text-muted-foreground">Sign in to keep it in your account</p>
            </div>
            <Button size="sm" className="rounded-full gap-1.5 shrink-0" onClick={handleSaveToAccount}>
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </Button>
            <button
              onClick={() => setSavePromptDismissed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mr-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Auto-save status indicator for signed-in users */}
      {isAuthenticated && saveStatus === "saved" && !isEmbed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Gift saved to your account</p>
              <p className="text-xs text-muted-foreground">View it anytime in My Gifts</p>
            </div>
            <Link href="/my-gifts">
              <Button size="sm" variant="outline" className="rounded-full shrink-0">
                View
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Already claimed by another account */}
      {isAuthenticated && saveStatus === "claimed" && !isEmbed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Gift already claimed</p>
              <p className="text-xs text-muted-foreground">This moment was saved by another account</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

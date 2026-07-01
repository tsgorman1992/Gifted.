import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, AlertCircle, Gift, LogIn, Check, X, ChevronDown, Settings, LogOut, Sparkles, Send } from "lucide-react";
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
  const [isGroup, setIsGroup] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "claimed">("idle");
  const [claimPending, setClaimPending] = useState(false);
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);

  // Group moment reaction form state (for viewers)
  const [groupReactorName, setGroupReactorName] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupSubmitted, setGroupSubmitted] = useState(false);
  const [groupReactionDismissed, setGroupReactionDismissed] = useState(false);

  // Group moment reactions feed state (for sender)
  type GiftReaction = { id: string; reactorName: string; message: string | null; createdAt: string };
  const [senderReactions, setSenderReactions] = useState<GiftReaction[]>([]);
  const [senderReactionsLoaded, setSenderReactionsLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      setStatus("error");
      setErrorMsg("No gift ID provided");
      return;
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

        localStorage.setItem("gifted_open_gift_id", gift.id);
        localStorage.setItem("gifted_gift_paid", gift.paid ? "true" : "false");

        setGiftId(gift.id);
        setGiftSenderUserId(gift.senderUserId ?? null);
        setGiftRecipientUserId(gift.recipientUserId ?? null);
        setGiftOpenedAt(gift.openedAt ?? null);
        setGiftRecipientName(gift.recipientName ?? "");
        setIsGroup(gift.isGroup ?? false);

        // Pre-fill reactor name from user account if available
        if (gift.isGroup && user?.firstName) {
          setGroupReactorName(user.firstName);
        }

        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong loading this moment");
      });
  }, [id]);

  // Pre-fill name from user once auth loads (if gift already loaded as group)
  useEffect(() => {
    if (isGroup && user?.firstName && !groupReactorName) {
      setGroupReactorName(user.firstName);
    }
  }, [isGroup, user?.firstName]);

  // When an authenticated non-sender opens a gift, show a "is this for you?" prompt
  // instead of silently auto-claiming it (prevents the wrong person in a group chat
  // from accidentally locking the gift to their account).
  // Skip prompt if this user is already the confirmed recipient (re-watching).
  // Skip entirely for group moments — they don't have individual recipients.
  useEffect(() => {
    if (!giftId || authLoading || !isAuthenticated) return;
    if (isGroup) return;
    if (user && giftSenderUserId && user.id === giftSenderUserId) return;
    // Only skip the prompt when this user has genuinely been here before:
    // recipientUserId matches them AND openedAt is set (they've already watched it).
    if (user && giftRecipientUserId && user.id === giftRecipientUserId && giftOpenedAt) {
      setSaveStatus("saved");
      return;
    }
    setClaimPending(true);
  }, [giftId, isAuthenticated, authLoading, user, giftSenderUserId, giftRecipientUserId, giftOpenedAt, isGroup]);

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

  const isSender = !!(user?.id && giftSenderUserId && user.id === giftSenderUserId);

  // Fetch reactions when sender reveals a group gift
  useEffect(() => {
    if (!giftId || !isGroup || !isSender || !revealed || senderReactionsLoaded) return;
    setSenderReactionsLoaded(true);
    fetch(`${BASE}/api/gifted/gifts/${giftId}/reactions`, { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSenderReactions(data.reactions ?? []);
        }
      })
      .catch(() => {});
  }, [giftId, isGroup, isSender, revealed, senderReactionsLoaded]);

  async function handleGroupReactionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!giftId || !groupReactorName.trim()) return;
    setGroupSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/gifts/${giftId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reactorName: groupReactorName.trim(),
          message: groupMessage.trim() || undefined,
        }),
      });
      if (res.ok) {
        setGroupSubmitted(true);
      }
    } catch {
      // silently fail
    } finally {
      setGroupSubmitting(false);
    }
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

  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "true";
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";

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
        <RevealPage onRevealComplete={handleRevealComplete} senderPreview={false} />
      </React.Suspense>

      {/* ── Group Moment reactions feed (sender view) ──────────────────────
          When the sender previews their own group gift after reveal, show
          the reactions they've received instead of the reaction form. */}
      {status === "ready" && isGroup && isSender && revealed && !isEmbed && (
        <div className={`fixed ${isPreview ? "bottom-20 sm:bottom-6" : "bottom-6"} left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4`}>
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3 max-h-72 flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">👥</span>
                <p className="font-semibold text-sm">Group reactions</p>
              </div>
              <span className="text-xs text-muted-foreground">{senderReactions.length} {senderReactions.length === 1 ? "reaction" : "reactions"}</span>
            </div>
            {senderReactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No reactions yet — share the link to get things started!</p>
            ) : (
              <div className="overflow-y-auto space-y-2 flex-1 pr-0.5">
                {senderReactions.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0 text-xs font-bold text-violet-700 dark:text-violet-300">
                      {r.reactorName[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold">{r.reactorName}</span>
                      {r.message && <p className="text-xs text-muted-foreground leading-snug mt-0.5">{r.message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Group Moment reaction form ──────────────────────────────────────
          Shown after the reveal for group moments. Replaces the save/claim
          prompts — group gifts can't be claimed by an individual account. */}
      {status === "ready" && isGroup && !isSender && revealed && !groupReactionDismissed && !isEmbed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4">
            {groupSubmitted ? (
              <div className="flex items-center gap-3 py-1">
                <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                  <span className="text-lg">🎉</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Reaction sent!</p>
                  <p className="text-xs text-muted-foreground">Thanks for sharing the love, {groupReactorName}.</p>
                </div>
                <button
                  onClick={() => setGroupReactionDismissed(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleGroupReactionSubmit} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-lg">👥</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">Leave a reaction</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Let them know you were here 💜</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGroupReactionDismissed(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mr-1 mt-0.5"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  placeholder="Your name"
                  value={groupReactorName}
                  onChange={(e) => setGroupReactorName(e.target.value)}
                  maxLength={80}
                  className="h-9 rounded-xl text-sm"
                  required
                />
                <Input
                  placeholder="Add a message… (optional)"
                  value={groupMessage}
                  onChange={(e) => setGroupMessage(e.target.value)}
                  maxLength={500}
                  className="h-9 rounded-xl text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full rounded-xl gap-1.5"
                  disabled={groupSubmitting || !groupReactorName.trim()}
                >
                  {groupSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send reaction
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* "Is this for you?" confirmation — shown for authenticated non-senders.
          Prevents the wrong person in a group chat from accidentally claiming the gift.
          Hidden for group moments (they use the reaction form above). */}
      {status === "ready" && !isGroup && claimPending && isAuthenticated && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">
                  Are you {giftRecipientName}?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">This gift was made for them — save it to keep it in your account.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmClaim}
                className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Yes, save to my account
              </button>
              <button
                onClick={handleDeclineClaim}
                className="flex-1 h-9 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Just browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save-to-account prompt — shown as soon as gift loads for signed-out users.
          Intentionally NOT gated on `revealed` — if the user closes the tab before
          finishing the reveal they should have already had a chance to save it.
          Hidden for group moments. */}
      {status === "ready" && !isGroup && !authLoading && !isAuthenticated && !savePromptDismissed && !isEmbed && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Save this moment</p>
              <p className="text-xs text-muted-foreground">Create a free account — or sign in — to keep it forever.</p>
            </div>
            <Button size="sm" className="rounded-full gap-1.5 shrink-0" onClick={handleSaveToAccount}>
              <LogIn className="w-3.5 h-3.5" />
              Save it
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
      {isAuthenticated && !isGroup && saveStatus === "saved" && !isEmbed && (
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
      {isAuthenticated && !isGroup && saveStatus === "claimed" && !isEmbed && (
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

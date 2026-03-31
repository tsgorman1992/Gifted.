import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Gift, LogIn, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [giftId, setGiftId] = useState<string | null>(null);
  const [giftSenderUserId, setGiftSenderUserId] = useState<string | null>(null);
  const [giftRecipientName, setGiftRecipientName] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "claimed">("idle");
  const [senderCopied, setSenderCopied] = useState(false);

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

        localStorage.setItem("gifted_gift_id", gift.id);
        localStorage.setItem("gifted_gift_paid", gift.paid ? "true" : "false");

        setGiftId(gift.id);
        setGiftSenderUserId(gift.senderUserId ?? null);
        setGiftRecipientName(gift.recipientName ?? "");
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong loading this moment");
      });
  }, [id]);

  // Auto-save when gift loads for authenticated users (no reveal action required)
  // Skip if the authenticated user is the sender — they don't receive their own gift
  useEffect(() => {
    if (!giftId || authLoading || !isAuthenticated) return;
    if (user && giftSenderUserId && user.id === giftSenderUserId) return;
    setSaveStatus("saving");
    saveReceivedGift(giftId)
      .then((result) => {
        if (result === "claimed-by-other") {
          setSaveStatus("claimed");
        } else if (result === "is-sender") {
          setSaveStatus("idle");
        } else {
          setSaveStatus("saved");
        }
      })
      .catch(() => setSaveStatus("idle"));
  }, [giftId, isAuthenticated, authLoading, user, giftSenderUserId]);

  function handleRevealComplete() {
    setRevealed(true);
  }

  function handleSaveToAccount() {
    if (!giftId) return;
    if (isAuthenticated && user && giftSenderUserId && user.id === giftSenderUserId) return;
    localStorage.setItem("gifted_auth_return", `/open/${giftId}?save-received=${giftId}`);
    setLocation("/sign-in");
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

  return (
    <>
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
      >
        <RevealPage onRevealComplete={handleRevealComplete} />
      </React.Suspense>

      {/* Save-to-account prompt — shown after reveal for signed-out users */}
      {revealed && !authLoading && !isAuthenticated && (
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
          </div>
        </div>
      )}

      {/* Auto-save status indicator for signed-in users */}
      {isAuthenticated && saveStatus === "saved" && (
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
      {isAuthenticated && saveStatus === "claimed" && (
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

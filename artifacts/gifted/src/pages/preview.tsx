import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Copy, MessageCircle, Share2, Check, ExternalLink,
  Sparkles, Video, Music, Image as ImageIcon, Loader2,
  CreditCard, CheckCircle2,
} from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { EXPERIENCE_MAP, DEFAULT_EXPERIENCE } from "@/lib/experiences";

export default function PreviewPage() {
  const [, setLocation] = useLocation();

  const [experience,     setExperience]     = useState(DEFAULT_EXPERIENCE);
  const [recipientName,  setRecipientName]  = useState(mockGiftData.recipientName);
  const [senderName,     setSenderName]     = useState(mockGiftData.senderName);
  const [giftTitle,      setGiftTitle]      = useState(mockGiftData.title);
  const [copied,         setCopied]         = useState(false);
  const [canShare,       setCanShare]       = useState(false);
  const [hasVideo,       setHasVideo]       = useState(false);
  const [videoUrl,       setVideoUrl]       = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [photoCount,     setPhotoCount]     = useState(0);
  const [hasPlaylist,    setHasPlaylist]    = useState(false);
  const [giftAmount,     setGiftAmount]     = useState<string | null>(null);
  const [giftIntent,     setGiftIntent]     = useState<string | null>(null);

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [giftId,    setGiftId]    = useState<string | null>(null);
  const [shareUrl,  setShareUrl]  = useState<string | null>(null);

  // Stripe payment state
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "confirming" | "confirmed" | "failed">("idle");
  const [payingError,   setPayingError]   = useState<string | null>(null);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    const exp = localStorage.getItem("gifted_experience");
    if (exp && EXPERIENCE_MAP[exp as keyof typeof EXPERIENCE_MAP]) setExperience(exp);

    const rn = localStorage.getItem("gifted_recipient_name");
    if (rn) setRecipientName(rn);

    const sn = localStorage.getItem("gifted_sender_name");
    if (sn) setSenderName(sn);

    const gt = localStorage.getItem("gifted_gift_title");
    if (gt) setGiftTitle(gt);

    const vp = localStorage.getItem("gifted_video_path");
    if (vp) { setHasVideo(true); setVideoUrl(`${base}/api/storage${vp}`); }

    const pp = localStorage.getItem("gifted_photo_paths");
    if (pp) {
      try { setPhotoCount(JSON.parse(pp).length); } catch { /* ignore */ }
    }

    const pl = localStorage.getItem("gifted_playlist_url");
    if (pl) setHasPlaylist(true);

    const amt = localStorage.getItem("gifted_amount");
    if (amt) setGiftAmount(amt);

    const intn = localStorage.getItem("gifted_intent");
    if (intn) setGiftIntent(intn);

    setCanShare(typeof navigator?.share === "function");

    // Handle return from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    const paidParam  = params.get("paid");
    const giftParam  = params.get("gift_id");
    const sessionId  = params.get("session_id");
    const cancelled  = params.get("cancelled");

    if (cancelled) {
      setPayingError("Payment cancelled — your gift is saved but not yet paid.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (paidParam === "true" && giftParam && sessionId) {
      setGiftId(giftParam);
      const url = `${window.location.origin}${base}/api/share/${giftParam}`;
      setShareUrl(url);
      setPaymentStatus("confirming");

      fetch(`${base}/api/gifted/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, giftId: giftParam }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Confirm failed");
          setPaymentStatus("confirmed");
        })
        .catch(() => {
          // Even if confirm fails (e.g. already confirmed), treat as paid
          setPaymentStatus("confirmed");
        });

      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [base]);

  const expMeta = EXPERIENCE_MAP[experience as keyof typeof EXPERIENCE_MAP] ?? EXPERIENCE_MAP[DEFAULT_EXPERIENCE];
  const gStyle  = { background: `linear-gradient(135deg, ${expMeta.palette.from}, ${expMeta.palette.via}, ${expMeta.palette.to})` };

  const saveGift = useCallback(async (): Promise<{ id: string; url: string } | null> => {
    if (giftId && shareUrl) return { id: giftId, url: shareUrl };

    setSaving(true);
    setSaveError(null);

    try {
      const payload: Record<string, unknown> = {
        recipientName: localStorage.getItem("gifted_recipient_name") || recipientName,
        senderName:    localStorage.getItem("gifted_sender_name")    || senderName,
        experience:    localStorage.getItem("gifted_experience")     || experience,
        occasion:      localStorage.getItem("gifted_occasion")       || "general",
        giftTitle:     localStorage.getItem("gifted_gift_title")     || giftTitle,
      };

      const pn = localStorage.getItem("gifted_personal_note");
      if (pn) payload.personalNote = pn;

      const vp = localStorage.getItem("gifted_video_path");
      if (vp) payload.videoPath = vp;

      const pp = localStorage.getItem("gifted_photo_paths");
      if (pp) { try { payload.photoPaths = JSON.parse(pp); } catch { /* ignore */ } }

      const pl = localStorage.getItem("gifted_playlist_url");
      if (pl) payload.playlistUrl = pl;

      const amt = localStorage.getItem("gifted_amount");
      if (amt) payload.amount = amt;

      const intn = localStorage.getItem("gifted_intent");
      if (intn) payload.intent = intn;

      const res = await fetch(`${base}/api/gifted/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");

      const { id } = await res.json();
      setGiftId(id);

      const url = `${window.location.origin}${base}/api/share/${id}`;
      setShareUrl(url);
      setSaving(false);
      return { id, url };
    } catch {
      setSaveError("Could not save your gift. Please try again.");
      setSaving(false);
      return null;
    }
  }, [giftId, shareUrl, base, recipientName, senderName, experience, giftTitle]);

  // ─── Stripe Pay & Send ───────────────────────────────────────────────────────
  const handlePayAndSend = async () => {
    setPayingError(null);
    const saved = await saveGift();
    if (!saved) return;

    setPaymentStatus("redirecting");

    const returnUrl = `${window.location.origin}${base}/preview`;

    try {
      const res = await fetch(`${base}/api/gifted/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ giftId: saved.id, returnUrl }),
      });

      if (!res.ok) throw new Error("Checkout failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setPaymentStatus("idle");
      setPayingError("Could not start checkout. Please try again.");
    }
  };

  // ─── Share helpers ────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const saved = await saveGift();
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    const saved = await saveGift();
    if (!saved) return;
    try {
      await navigator.share({
        title: `A gift for ${recipientName} 🎁`,
        text: `${senderName} sent you something on gifted.`,
        url: saved.url,
      });
    } catch { /* user cancelled */ }
  };

  const handleSMS = async () => {
    const saved = await saveGift();
    if (!saved) return;
    const body = `Hey ${recipientName}, I made something for you 🎁\n${saved.url}`;
    window.open(`sms:?body=${encodeURIComponent(body)}`, "_blank");
  };

  const handleRevealPreview = () => {
    localStorage.setItem("gifted_experience", experience);
    setLocation("/reveal");
  };

  const displayUrl   = giftId ? `gifted./open/${giftId}` : "gifted./open/...";
  const displayAmt   = giftAmount ? parseFloat(giftAmount).toFixed(2) : null;
  const hasBalance   = !!displayAmt && parseFloat(displayAmt) > 0;
  const isPaid       = paymentStatus === "confirmed" || paymentStatus === "confirming";
  const isRedirecting = paymentStatus === "redirecting";

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as number[] },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-14 flex flex-col md:flex-row gap-8 md:gap-14">

        {/* Desktop: phone mockup */}
        <div className="hidden md:block flex-1">
          <div className="sticky top-24">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-4 text-center">
              Recipient view
            </p>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[2rem] border border-border shadow-2xl overflow-hidden"
            >
              <div className="h-6 w-full bg-secondary/50 border-b border-border flex justify-center items-center">
                <div className="w-16 h-1 rounded-full bg-border" />
              </div>
              <div className="h-[580px] overflow-y-auto overflow-x-hidden bg-background">
                <div className="h-56 relative" style={gStyle}>
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <p className="text-xs font-medium opacity-75 mb-0.5">A gift for</p>
                    <h3 className="font-serif text-3xl mb-3">{recipientName}</h3>
                    <div className="w-full h-px bg-white/20 mb-3" />
                    <p className="text-xs opacity-75">From {senderName}</p>
                  </div>
                </div>
                <div className="p-5 space-y-7">
                  <div>
                    <h4 className="font-serif text-xl mb-2">{giftTitle}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{mockGiftData.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasVideo && (
                      <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                        <Video className="w-3 h-3 text-primary" /> Video
                      </span>
                    )}
                    {photoCount > 0 && (
                      <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3 text-primary" /> {photoCount} Photo{photoCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hasPlaylist && (
                      <span className="px-3 py-1 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                        <Music className="w-3 h-3 text-primary" /> Playlist
                      </span>
                    )}
                  </div>
                  {giftAmount && (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                      <div>
                        {giftIntent && <p className="text-xs text-muted-foreground mb-0.5">{giftIntent}</p>}
                        <p className="text-2xl font-bold font-serif text-primary">${giftAmount}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right / main column */}
        <div className="flex-[0.9] flex flex-col">

          {/* Experience summary card */}
          <motion.div {...fade(0)} className="rounded-[2rem] overflow-hidden mb-7 shadow-xl relative" style={{ minHeight: 160 }}>
            <div className="absolute inset-0" style={gStyle} />
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10 p-6 flex flex-col justify-between" style={{ minHeight: 160 }}>
              <div
                className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
              >
                <Sparkles className="w-3 h-3" />
                {expMeta.name}
              </div>
              <div>
                <p className="text-white/65 text-xs font-medium mb-0.5">A gift for</p>
                <h2 className="font-serif text-4xl text-white leading-none mb-1">{recipientName}</h2>
                <p className="text-white/55 text-sm">from {senderName}</p>
              </div>
            </div>
          </motion.div>

          {/* Video confirmation */}
          {hasVideo && videoUrl && (
            <motion.div {...fade(0.04)} className="mb-5 rounded-2xl overflow-hidden border border-border bg-card">
              <div className="aspect-video w-full relative">
                {!videoLoadError ? (
                  <video
                    src={videoUrl}
                    playsInline
                    controls
                    preload="metadata"
                    className="w-full h-full object-cover"
                    onError={() => setVideoLoadError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <p className="text-sm text-muted-foreground">Video preview unavailable</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 flex items-center gap-2">
                <Video className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Your video message is included</span>
              </div>
            </motion.div>
          )}

          <motion.div {...fade(0.08)}>
            {isPaid ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    {paymentStatus === "confirming" ? "Confirming payment…" : `$${displayAmt} paid`}
                  </span>
                </div>
                <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2">Gift paid & ready!</h1>
                <p className="text-muted-foreground mb-7 text-base">
                  Share the link with {recipientName} — they can now open and redeem their gift.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2">
                  {hasBalance ? "One last step." : "Your gift is ready."}
                </h1>
                <p className="text-muted-foreground mb-7 text-base">
                  {hasBalance
                    ? `Pay the $${displayAmt} balance, then share the link with ${recipientName}.`
                    : `Send ${recipientName} the link below — they'll see a beautiful animated reveal.`}
                </p>
              </>
            )}
          </motion.div>

          <motion.div {...fade(0.15)} className="space-y-3">

            {/* Error notices */}
            {saveError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {saveError}
              </div>
            )}
            {payingError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {payingError}
              </div>
            )}

            {/* Link preview card */}
            <div className="rounded-2xl border border-border overflow-hidden bg-card">
              <div className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex-shrink-0" style={gStyle} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">gifted.</p>
                  <p className="text-sm font-semibold text-foreground leading-snug">A gift for {recipientName} 🎁</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">from {senderName} — tap to open</p>
                </div>
              </div>
              <div className="border-t border-border/60 px-4 py-2.5 flex items-center gap-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-mono truncate flex-1">{displayUrl}</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={saving || isRedirecting}
                  className="flex items-center gap-1 text-xs font-semibold text-primary shrink-0 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {saving ? "Saving..." : copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Primary CTA — Pay & Send when balance unpaid, or Share when no balance / already paid */}
            {hasBalance && !isPaid ? (
              <Button
                onClick={handlePayAndSend}
                disabled={saving || isRedirecting}
                className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200 gap-2"
              >
                {isRedirecting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to checkout…</>
                  : saving
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving gift…</>
                    : <><CreditCard className="w-5 h-5" /> Pay ${displayAmt} &amp; Send</>
                }
              </Button>
            ) : (
              <Button
                onClick={canShare ? handleShare : handleSMS}
                disabled={saving}
                className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                {saving
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving gift...</>
                  : canShare
                    ? <><Share2 className="w-5 h-5 mr-2" /> Share this gift</>
                    : <><MessageCircle className="w-5 h-5 mr-2" /> Message {recipientName}</>
                }
              </Button>
            )}

            {/* Secondary row */}
            <div className="flex gap-3">
              {canShare && (
                <Button
                  variant="outline"
                  onClick={handleSMS}
                  disabled={saving || isRedirecting}
                  className="flex-1 h-12 rounded-xl text-sm font-medium"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> SMS
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={saving || isRedirecting}
                className="flex-1 h-12 rounded-xl text-sm font-medium"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  : copied
                    ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
                    : <><Copy className="w-4 h-4 mr-2" /> Copy link</>
                }
              </Button>
            </div>

            {/* Reveal preview nudge */}
            <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Preview their reveal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See the full animated experience as {recipientName} will see it
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRevealPreview}
                className="rounded-xl shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open
              </Button>
            </div>

            {hasBalance && !isPaid && (
              <p className="text-center text-xs text-muted-foreground">
                You can also share the link without paying — your recipient will see the gift but can't redeem the balance until payment is complete.
              </p>
            )}

            {/* Footer link */}
            <div className="pt-1 text-center">
              <Link
                href="/create"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                Go back and edit
              </Link>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}

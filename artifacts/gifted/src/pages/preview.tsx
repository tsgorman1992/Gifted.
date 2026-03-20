import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Copy, MessageCircle, Share2, Check,
  Sparkles, Video, Music, Image as ImageIcon, Loader2,
  CheckCircle2, Send, User, ArrowLeft, Eye, X, ExternalLink,
} from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { EXPERIENCE_MAP, DEFAULT_EXPERIENCE } from "@/lib/experiences";
import { useAuth } from "@/lib/auth-context";

export default function PreviewPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
  const [previewLinks, setPreviewLinks] = useState<Array<{url: string; label: string; subtitle?: string}>>([]);
  const [giftAmount,     setGiftAmount]     = useState<string | null>(null);
  const [giftIntent,     setGiftIntent]     = useState<string | null>(null);
  const [personalNote,   setPersonalNote]   = useState<string | null>(null);
  const [scheduledFor,   setScheduledFor]   = useState<string | null>(null);
  const [scheduledTime,  setScheduledTime]  = useState<string>("09:00");

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

    const el2 = localStorage.getItem("gifted_extra_links");
    if (el2) {
      try {
        const p = JSON.parse(el2);
        if (Array.isArray(p) && p.length > 0) {
          const normalized = p
            .map((item: string | {url: string; label: string; subtitle?: string}) =>
              typeof item === "string" ? { url: item, label: "" } : item
            )
            .filter((l: {url: string}) => l.url);
          if (normalized.length > 0) setPreviewLinks(normalized);
        }
      } catch { /* ignore */ }
    } else {
      const pl = localStorage.getItem("gifted_playlist_url");
      if (pl) setPreviewLinks([{ url: pl, label: "" }]);
    }

    const amt = localStorage.getItem("gifted_amount");
    if (amt && parseFloat(amt) > 0) setGiftAmount(amt);
    else localStorage.removeItem("gifted_amount");

    const intn = localStorage.getItem("gifted_intent");
    if (intn) setGiftIntent(intn);

    const pn = localStorage.getItem("gifted_personal_note");
    if (pn) setPersonalNote(pn);

    const sf = localStorage.getItem("gifted_scheduled_for");
    if (sf) setScheduledFor(sf);
    const st = localStorage.getItem("gifted_scheduled_time");
    if (st) setScheduledTime(st);

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

    // Restore paid state if user navigates back after payment
    const savedPaidId = localStorage.getItem("gifted_paid_id");
    if (savedPaidId) {
      setGiftId(savedPaidId);
      const url = `${window.location.origin}${base}/api/share/${savedPaidId}`;
      setShareUrl(url);
      setPaymentStatus("confirmed");
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
          localStorage.setItem("gifted_paid_id", giftParam);
        })
        .catch(() => {
          // Even if confirm fails (e.g. already confirmed), treat as paid
          setPaymentStatus("confirmed");
          localStorage.setItem("gifted_paid_id", giftParam);
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

      const rp = localStorage.getItem("gifted_recipient_phone");
      if (rp) payload.recipientPhone = rp;

      const pn = localStorage.getItem("gifted_personal_note");
      if (pn) payload.personalNote = pn;

      const vp = localStorage.getItem("gifted_video_path");
      if (vp) payload.videoPath = vp;

      const pp = localStorage.getItem("gifted_photo_paths");
      if (pp) { try { payload.photoPaths = JSON.parse(pp); } catch { /* ignore */ } }

      const el = localStorage.getItem("gifted_extra_links");
      if (el) { try { const parsed = JSON.parse(el); if (Array.isArray(parsed) && parsed.length > 0) payload.extraLinks = parsed; } catch { /* ignore */ } }
      else { const pl = localStorage.getItem("gifted_playlist_url"); if (pl) payload.extraLinks = [pl]; }

      const amt = localStorage.getItem("gifted_amount");
      if (amt) payload.amount = amt;

      const intn = localStorage.getItem("gifted_intent");
      if (intn) payload.intent = intn;

      const sf = localStorage.getItem("gifted_scheduled_for");
      const st = localStorage.getItem("gifted_scheduled_time") || "09:00";
      if (sf) payload.scheduledFor = `${sf}T${st}:00`;

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

  const [revealUrl, setRevealUrl] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const buildRevealUrl = (savedId: string) => {
    const b = import.meta.env.BASE_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    params.set("giftId", savedId);
    params.set("preview", "true");
    return `${b}/reveal?${params.toString()}`;
  };

  const handleMobileRevealPreview = async () => {
    if (!revealUrl) {
      const saved = await saveGift();
      if (!saved) return;
      setRevealUrl(buildRevealUrl(saved.id));
    }
    setMobilePreviewOpen(true);
  };

  const handleDesktopRevealLoad = async () => {
    if (revealUrl) return;
    const saved = await saveGift();
    if (!saved) return;
    const url = buildRevealUrl(saved.id);
    setRevealUrl(url);
  };

  const desktopLoadRef = useRef(false);
  useEffect(() => {
    if (desktopLoadRef.current) return;
    if (window.innerWidth < 768) return;
    desktopLoadRef.current = true;
    handleDesktopRevealLoad();
  }, []);

  const handleEdit = () => {
    localStorage.removeItem("gifted_paid_id");
    setGiftId(null);
    setShareUrl(null);
    setPaymentStatus("idle");
    setLocation("/create");
  };

  const displayUrl   = giftId ? `gifted.page/open/${giftId}` : "gifted.page/open/...";
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

        {/* Desktop: inline reveal experience */}
        <div className="hidden md:flex flex-col flex-1">
          <div className="sticky top-24">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-4 text-center">
              Their reveal experience
            </p>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[2rem] overflow-hidden shadow-2xl"
              style={{ aspectRatio: "9/19.5" }}
            >
              {revealUrl ? (
                <iframe
                  src={revealUrl}
                  className="w-full h-full border-0 block"
                  title="Gift reveal preview"
                  allow="autoplay"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-4 relative cursor-pointer group"
                  style={{ background: `linear-gradient(155deg, ${expMeta.palette.from}, ${expMeta.palette.via}, ${expMeta.palette.to})` }}
                  onClick={handleDesktopRevealLoad}
                >
                  <div className="absolute inset-0 bg-black/15" />
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                    className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                  >
                    <Eye className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="relative z-10 text-center px-6">
                    <p className="text-white font-semibold text-sm mb-1">Preview the reveal</p>
                    <p className="text-white/70 text-xs">
                      {saving ? "Saving gift…" : "See the animated experience"}
                    </p>
                  </div>
                  {saving && (
                    <div className="relative z-10">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Right / main column */}
        <div className="flex-[0.9] flex flex-col">

          {/* Edit link — subtle, above the card */}
          {!isPaid && (
            <button
              type="button"
              onClick={handleEdit}
              className="self-start inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Edit gift
            </button>
          )}

          {/* Experience summary card — desktop only */}
          <motion.div {...fade(0)} className="hidden md:block rounded-[2rem] overflow-hidden mb-7 shadow-xl relative" style={{ minHeight: 160 }}>
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

          {/* Video confirmation — desktop only */}
          {hasVideo && videoUrl && (
            <motion.div {...fade(0.04)} className="hidden md:block mb-5 rounded-2xl overflow-hidden border border-border bg-card">
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

          {/* Mobile: inline reveal preview — tap to expand */}
          <AnimatePresence mode="wait">
            {mobilePreviewOpen ? (
              <motion.div
                key="reveal-open"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="md:hidden mb-6 flex flex-col shadow-2xl rounded-[2rem] overflow-hidden"
              >
                <div style={{ height: "70dvh" }}>
                  {revealUrl ? (
                    <iframe
                      src={revealUrl}
                      className="w-full h-full border-0 block"
                      title="Gift reveal preview"
                      allow="autoplay"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={gStyle}>
                      <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePreviewOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-foreground text-background text-sm font-semibold shrink-0"
                  style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
                >
                  <X className="w-4 h-4" /> Close preview
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="reveal-teaser"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleMobileRevealPreview}
                disabled={saving}
                className="md:hidden w-full mb-6 rounded-2xl overflow-hidden relative text-left"
                style={{ minHeight: 100 }}
              >
                <div className="absolute inset-0" style={gStyle} />
                <div className="absolute inset-0 bg-black/25" />
                <div className="relative z-10 p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white/70 text-xs font-medium mb-0.5">A gift for</p>
                    <p className="font-serif text-2xl text-white leading-none">{recipientName}</p>
                    <p className="text-white/60 text-xs mt-1">from {senderName}</p>
                  </div>
                  <div
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", color: "white" }}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    {saving ? "Saving…" : "Preview"}
                  </div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.div {...fade(0.08)}>
            {isPaid ? (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </motion.div>
                <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2">
                  {paymentStatus === "confirming" ? "Confirming…" : "Your gift is ready."}
                </h1>
                <p className="text-muted-foreground mb-7 text-base">
                  {paymentStatus === "confirming"
                    ? "Just a moment while we confirm everything…"
                    : `${recipientName}'s gift is ready. Share the link below and the experience begins the moment they tap it.`}
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2">
                  {hasBalance ? "Ready to send." : "Your gift is ready."}
                </h1>
                <p className="text-muted-foreground mb-7 text-base">
                  {hasBalance
                    ? `Load $${displayAmt} onto the gift, then send the link — ${recipientName}'s reveal is waiting.`
                    : `Send ${recipientName} the link below — they'll see a beautiful animated reveal.`}
                </p>
              </>
            )}
          </motion.div>

          <motion.div {...fade(0.15)} className="space-y-3">

            {/* Scheduled delivery badge */}
            {scheduledFor && !isPaid && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Scheduled delivery</p>
                  <p className="text-xs text-muted-foreground">
                    {recipientName} will receive the link on{" "}
                    {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}{" "}at{" "}
                    {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit",
                    })}.
                  </p>
                </div>
              </div>
            )}

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

            {/* Link cards — sender sees their labels before sending */}
            {previewLinks.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Links you added</p>
                <div className="space-y-2">
                  {previewLinks.map((link, i) => {
                    const u = link.url.toLowerCase();
                    const isMusic = u.includes("spotify.com") || u.includes("music.apple.com") || u.includes("soundcloud.com") || u.includes("tidal.com") || u.includes("deezer.com");
                    const fallbackLabel =
                      u.includes("spotify.com") ? "Spotify" :
                      u.includes("music.apple.com") ? "Apple Music" :
                      u.includes("youtube.com") || u.includes("youtu.be") ? "YouTube" :
                      isMusic ? "Music link" :
                      u.includes("ticketmaster.com") || u.includes("eventbrite.com") ? "Event Tickets" :
                      u.includes("opentable.com") || u.includes("resy.com") ? "Reservation" :
                      u.includes("airbnb.com") || u.includes("vrbo.com") ? "Stay link" :
                      "Open link";
                    const fallbackSubtitle = isMusic ? "Tap to listen" : "Tap to open";
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                          style={{ background: "hsl(var(--primary)/0.1)" }}
                        >
                          {isMusic
                            ? <Music className="w-4 h-4 text-primary" />
                            : <ExternalLink className="w-4 h-4 text-primary" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate">{link.label || fallbackLabel}</p>
                          <p className="text-xs text-muted-foreground truncate">{link.subtitle || fallbackSubtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bridge moment — what's inside, before the payment ask */}
            {hasBalance && !isPaid && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What {recipientName} will experience</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>A cinematic reveal, just for them</span>
                  </li>
                  {hasVideo && (
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Your video message</span>
                    </li>
                  )}
                  {photoCount > 0 && (
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{photoCount} {photoCount === 1 ? "photo" : "photos"} from you</span>
                    </li>
                  )}
                  {previewLinks.map((link, i) => {
                    const u = link.url.toLowerCase();
                    const isMusic = u.includes("spotify.com") || u.includes("music.apple.com") || u.includes("soundcloud.com") || u.includes("tidal.com") || u.includes("deezer.com");
                    const fallbackLabel =
                      u.includes("spotify.com") ? "Spotify" :
                      u.includes("music.apple.com") ? "Apple Music" :
                      u.includes("youtube.com") || u.includes("youtu.be") ? "YouTube" :
                      isMusic ? "Music link" :
                      "A link";
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                        {isMusic
                          ? <Music className="w-3.5 h-3.5 text-primary shrink-0" />
                          : <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                        }
                        <span>{link.label || fallbackLabel}</span>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 text-sm text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>${displayAmt}{giftIntent ? ` — ${giftIntent}` : " to spend however they like"}</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Primary CTA — load balance and send */}
            {hasBalance && !isPaid && (
              <Button
                onClick={handlePayAndSend}
                disabled={saving || isRedirecting}
                className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200 gap-2"
              >
                {isRedirecting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to checkout…</>
                  : saving
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving gift…</>
                    : <><Send className="w-5 h-5" /> Load ${displayAmt} &amp; send the gift</>
                }
              </Button>
            )}

            {/* ── Share / copy — sender shares the link themselves ── */}
            {(!hasBalance || isPaid) && (
              <div className="flex gap-3">
                <Button
                  onClick={canShare ? handleShare : handleSMS}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    : canShare
                      ? <><Share2 className="w-4 h-4 mr-2" /> Share</>
                      : <><MessageCircle className="w-4 h-4 mr-2" /> SMS</>
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  disabled={saving || isRedirecting}
                  className="flex-1 h-12 rounded-xl text-sm font-medium"
                >
                  {copied ? <><Check className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy link</>}
                </Button>
              </div>
            )}

            {/* Desktop hint pointing to the left panel */}
            <div className="hidden md:flex items-center gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-3.5">
              <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Reveal preview</span> — click the panel on the left to see {recipientName}&apos;s experience
              </p>
            </div>


            {/* Login prompt — only shown to unauthenticated senders */}
            {!isPaid && !authLoading && !isAuthenticated && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-border bg-secondary/30">
                <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-snug">
                  <Link href="/sign-in" className="font-medium text-foreground hover:underline">Sign in</Link> to track this gift and see when it's opened — view all your gifts in one place.
                </p>
              </div>
            )}

            {/* Footer link */}
            {!isPaid && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Go back and edit
                </button>
              </div>
            )}

          </motion.div>
        </div>
      </div>
    </div>
  );
}

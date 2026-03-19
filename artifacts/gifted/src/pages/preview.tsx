import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Copy, MessageCircle, Share2, Check, ExternalLink,
  Sparkles, Video, Music, Image as ImageIcon, Loader2,
  CreditCard, CheckCircle2, Send, Mail, Phone,
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
  const [scheduledFor,   setScheduledFor]   = useState<string | null>(null);
  const [scheduledTime,  setScheduledTime]  = useState<string>("09:00");

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [giftId,    setGiftId]    = useState<string | null>(null);
  const [shareUrl,  setShareUrl]  = useState<string | null>(null);

  // Stripe payment state
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "confirming" | "confirmed" | "failed">("idle");
  const [payingError,   setPayingError]   = useState<string | null>(null);

  // Desktop send form state
  const [isDesktop,   setIsDesktop]   = useState(false);
  const [sendContact, setSendContact] = useState("");
  const [sendStatus,  setSendStatus]  = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError,   setSendError]   = useState<string | null>(null);
  const sendInputRef = useRef<HTMLInputElement>(null);

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
    if (amt && parseFloat(amt) > 0) setGiftAmount(amt);
    else localStorage.removeItem("gifted_amount");

    const intn = localStorage.getItem("gifted_intent");
    if (intn) setGiftIntent(intn);

    const sf = localStorage.getItem("gifted_scheduled_for");
    if (sf) setScheduledFor(sf);
    const st = localStorage.getItem("gifted_scheduled_time");
    if (st) setScheduledTime(st);

    setCanShare(typeof navigator?.share === "function");
    setIsDesktop(window.innerWidth >= 768);

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

      const pl = localStorage.getItem("gifted_playlist_url");
      if (pl) payload.playlistUrl = pl;

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

  const handleRevealPreview = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    params.set("experience", experience);
    params.set("recipientName", recipientName);
    params.set("senderName", senderName);
    if (giftTitle) params.set("giftTitle", giftTitle);
    if (giftAmount && parseFloat(giftAmount) > 0) params.set("amount", giftAmount);
    if (giftIntent) params.set("intent", giftIntent);
    const pn = localStorage.getItem("gifted_personal_note");
    if (pn) params.set("personalNote", pn);
    params.set("preview", "true");
    window.open(`${base}/reveal?${params.toString()}`, "_blank");
  };

  const handleDesktopSend = async () => {
    const contact = sendContact.trim();
    if (!contact) return;

    const saved = await saveGift();
    if (!saved) return;

    setSendStatus("sending");
    setSendError(null);

    try {
      const res = await fetch(`${base}/api/gifted/send-gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          giftId: saved.id,
          contact,
          recipientName,
          senderName,
          giftUrl: saved.url,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendStatus("error");
        setSendError(data.error || "Could not send. Please copy the link instead.");
        return;
      }

      if (data.method === "email" && data.mailtoUrl) {
        window.open(data.mailtoUrl, "_blank");
        setSendStatus("sent");
        return;
      }

      setSendStatus("sent");
    } catch {
      setSendStatus("error");
      setSendError("Network error. Please copy the link and send it manually.");
    }
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
                        <Music className="w-3 h-3 text-primary" /> Link
                      </span>
                    )}
                  </div>
                  {hasBalance && (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                      <div>
                        {giftIntent && <p className="text-xs text-muted-foreground mb-0.5">{giftIntent}</p>}
                        <p className="text-2xl font-bold font-serif text-primary">${displayAmt}</p>
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
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4"
                >
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </motion.div>
                <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2">
                  {paymentStatus === "confirming" ? "Confirming payment…" : "Gift sent!"}
                </h1>
                <p className="text-muted-foreground mb-7 text-base">
                  {paymentStatus === "confirming"
                    ? "Just a moment while we confirm your payment…"
                    : `$${displayAmt} paid. Now send ${recipientName} the link below — their experience is ready.`}
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

            {/* Primary CTA — Pay & Send when balance unpaid */}
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
                    : <><CreditCard className="w-5 h-5" /> Pay ${displayAmt} &amp; Send</>
                }
              </Button>
            )}

            {/* ── Desktop: clean send form ── */}
            {isDesktop && (!hasBalance || isPaid) && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-semibold">Send to {recipientName}</p>
                <p className="text-xs text-muted-foreground">Enter their phone number or email — we'll deliver the link directly.</p>
                {sendStatus === "sent" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl bg-green-50 border border-green-200"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Gift sent!</p>
                      <p className="text-xs text-green-700">{recipientName} will receive the link shortly.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSendStatus("idle"); setSendContact(""); }}
                      className="ml-auto text-xs text-green-700 underline"
                    >
                      Send again
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        {sendContact.includes("@")
                          ? <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          : <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        }
                        <input
                          ref={sendInputRef}
                          type="text"
                          value={sendContact}
                          onChange={e => { setSendContact(e.target.value); setSendStatus("idle"); setSendError(null); }}
                          onKeyDown={e => e.key === "Enter" && handleDesktopSend()}
                          placeholder="Phone number or email"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                        />
                      </div>
                      <Button
                        onClick={handleDesktopSend}
                        disabled={!sendContact.trim() || sendStatus === "sending" || saving}
                        className="h-11 px-5 rounded-xl shrink-0"
                      >
                        {sendStatus === "sending"
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Send className="w-4 h-4 mr-1.5" /> Send</>
                        }
                      </Button>
                    </div>
                    {sendError && (
                      <p className="text-xs text-destructive">{sendError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Mobile: native share buttons ── */}
            {!isDesktop && (!hasBalance || isPaid) && (
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
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl text-sm font-medium"
                >
                  {copied ? <><Check className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy link</>}
                </Button>
              </div>
            )}

            {/* Desktop: copy link — only available once paid (or no balance) */}
            {isDesktop && (!hasBalance || isPaid) && (
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={saving || isRedirecting}
                className="w-full h-11 rounded-xl text-sm font-medium"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  : copied
                    ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
                    : <><Copy className="w-4 h-4 mr-2" /> Copy link instead</>
                }
              </Button>
            )}

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

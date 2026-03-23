import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Copy, MessageCircle, Share2, Check,
  Sparkles, Video, Music, Image as ImageIcon, Loader2,
  CheckCircle2, Send, ArrowLeft, Eye, X, ExternalLink, Gift, Bell, QrCode, Download,
} from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { EXPERIENCE_MAP, DEFAULT_EXPERIENCE } from "@/lib/experiences";
import { useAuth } from "@/lib/auth-context";
import QRCodeLib from "qrcode";
import { trackEvent } from "@/lib/analytics";

// ─── QR Code component ────────────────────────────────────────────────────────

function QRCodeDisplay({ url, label }: { url: string; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    setReady(false);
    setError(false);
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(() => setReady(true)).catch(() => setError(true));
  }, [url]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "gift-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-xs text-muted-foreground">Couldn&apos;t generate QR code</p>
        <p className="text-xs text-muted-foreground/60">Use the copy link option instead</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-2xl overflow-hidden border border-border p-3 bg-white"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
      >
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 8 }} />
      </div>
      {!ready && (
        <div className="w-[224px] h-[224px] rounded-2xl border border-border bg-secondary animate-pulse" />
      )}
      {label && (
        <p className="text-xs text-muted-foreground text-center max-w-[180px]">{label}</p>
      )}
      {ready && (
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download QR code
        </button>
      )}
    </div>
  );
}

export default function PreviewPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, refetch } = useAuth();

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

  const [desktopContact,    setDesktopContact]    = useState("");
  const [desktopSendStatus, setDesktopSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [desktopSendError,  setDesktopSendError]  = useState<string | null>(null);
  const [linkShared,        setLinkShared]        = useState(false);
  const [showQr,            setShowQr]            = useState(false);

  // Stripe payment state
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "confirming" | "confirmed" | "failed">("idle");
  const [payingError,   setPayingError]   = useState<string | null>(null);

  // Google OAuth availability (used in nudge forms)
  const [googleEnabled,    setGoogleEnabled]    = useState(false);

  // Free gift nudge (shown after sharing a free gift, for anonymous senders)
  const [nudgeFormOpen,    setNudgeFormOpen]    = useState(false);
  const [nudgeMode,        setNudgeMode]        = useState<"sign-in" | "sign-up">("sign-in");
  const [nudgeEmail,       setNudgeEmail]       = useState("");
  const [nudgePassword,    setNudgePassword]    = useState("");
  const [nudgeFirstName,   setNudgeFirstName]   = useState("");
  const [nudgeLastName,    setNudgeLastName]    = useState("");
  const [nudgeSubmitting,  setNudgeSubmitting]  = useState(false);
  const [nudgeError,       setNudgeError]       = useState<string | null>(null);
  const [notifyPhone,      setNotifyPhone]      = useState("");
  const [notifySaving,     setNotifySaving]     = useState(false);
  const [notifySaved,      setNotifySaved]      = useState(false);

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

    // Restore linkShared for free gifts (paid gifts use paymentStatus)
    if (localStorage.getItem("gifted_link_shared") && !savedPaidId) {
      setLinkShared(true);
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
          const paidAmt = localStorage.getItem("gifted_amount");
          trackEvent("gift_paid", {
            currency: "USD",
            value:    paidAmt ? parseFloat(paidAmt) : 0,
            gift_id:  giftParam,
          });
        })
        .catch(() => {
          // Even if confirm fails (e.g. already confirmed), treat as paid
          setPaymentStatus("confirmed");
          localStorage.setItem("gifted_paid_id", giftParam);
          const paidAmt = localStorage.getItem("gifted_amount");
          trackEvent("gift_paid", {
            currency: "USD",
            value:    paidAmt ? parseFloat(paidAmt) : 0,
            gift_id:  giftParam,
          });
        });

      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [base]);

  // Fetch whether Google OAuth is available
  useEffect(() => {
    fetch(`${base}/api/auth/google/enabled`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setGoogleEnabled(!!d.enabled))
      .catch(() => {});
  }, [base]);

  // Auto-trigger Stripe checkout if Google OAuth was used during a pending payment
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    const stored = localStorage.getItem("gifted_auth_pending_checkout");
    if (stored) {
      localStorage.removeItem("gifted_auth_pending_checkout");
      handlePayAndSend();
    }
  }, [isAuthenticated, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire signup_nudge_shown once when the paid nudge becomes visible
  const nudgeShownFiredRef = useRef(false);
  useEffect(() => {
    const isPaidLocal = paymentStatus === "confirmed" || paymentStatus === "confirming";
    if (isPaidLocal && !isAuthenticated && !authLoading && !nudgeShownFiredRef.current) {
      nudgeShownFiredRef.current = true;
      trackEvent("signup_nudge_shown");
    }
  }, [paymentStatus, isAuthenticated, authLoading]);

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

      trackEvent("gift_created", {
        experience:  localStorage.getItem("gifted_experience") || experience,
        occasion:    localStorage.getItem("gifted_occasion")   || "general",
        hasBalance:  !!(amt && parseFloat(amt) > 0),
        hasVideo:    !!(localStorage.getItem("gifted_video_path")),
        photoCount:  (() => { try { return JSON.parse(localStorage.getItem("gifted_photo_paths") || "[]").length; } catch { return 0; } })(),
      });

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

    // Ensure the gift is linked to the current user. Handles the case where the
    // gift was saved anonymously during desktop preview load (before the auth gate).
    // 409 = already owned (fine), 401 = not authenticated (should not happen here).
    await fetch(`${base}/api/gifted/gifts/${saved.id}/claim`, {
      method: "PATCH",
      credentials: "include",
    }).catch(() => {});

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

  // ─── Free gift nudge submit (claim + navigate to dashboard) ─────────────────
  const handleNudgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNudgeError(null);
    setNudgeSubmitting(true);
    const endpoint = nudgeMode === "sign-in" ? "/api/auth/login" : "/api/auth/register";
    const body: Record<string, string> = { email: nudgeEmail, password: nudgePassword };
    if (nudgeMode === "sign-up") { body.firstName = nudgeFirstName; body.lastName = nudgeLastName; }
    try {
      const res = await fetch(`${base}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setNudgeError(data.error || "Something went wrong. Please try again.");
        return;
      }
      await refetch();
      trackEvent("signup_nudge_converted", { mode: nudgeMode });
      if (giftId) {
        await fetch(`${base}/api/gifted/gifts/${giftId}/claim`, {
          method: "PATCH",
          credentials: "include",
        }).catch(() => {});
      }
      setLocation("/my-gifts");
    } catch {
      setNudgeError("Unable to connect. Please try again.");
    } finally {
      setNudgeSubmitting(false);
    }
  };

  const handleNotifyPhoneSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftId || !notifyPhone.trim()) return;
    setNotifySaving(true);
    try {
      await fetch(`${base}/api/gifted/gifts/${giftId}/sender-phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ senderPhone: notifyPhone.trim() }),
      });
      setNotifySaved(true);
    } catch { /* silent — not critical */ } finally {
      setNotifySaving(false);
    }
  };

  // ─── Share helpers ────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const saved = await saveGift();
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.url);
      setCopied(true);
      setLinkShared(true);
      localStorage.setItem("gifted_link_shared", "1");
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
        text: `Hey ${recipientName} — I made something for you 🎁`,
        url: saved.url,
      });
      setLinkShared(true);
      localStorage.setItem("gifted_link_shared", "1");
    } catch { /* user cancelled */ }
  };

  const handleSMS = async () => {
    const saved = await saveGift();
    if (!saved) return;
    const body = `Hey ${recipientName} — I made something for you 🎁\n${saved.url}`;
    // Use location.href (not window.open) so Android Chrome doesn't block the sms: scheme
    window.location.href = `sms:?body=${encodeURIComponent(body)}`;
    setLinkShared(true);
    localStorage.setItem("gifted_link_shared", "1");
  };

  const handleDesktopSend = async () => {
    const contact = desktopContact.trim();
    if (!contact) return;
    setDesktopSendError(null);

    const isEmail = contact.includes("@");
    const saved = await saveGift();
    if (!saved) return;

    if (isEmail) {
      try { await navigator.clipboard.writeText(saved.url); } catch { /* ignore */ }
      setDesktopSendStatus("sent");
      setLinkShared(true);
      localStorage.setItem("gifted_link_shared", "1");
    } else {
      setDesktopSendStatus("sending");
      try {
        const res = await fetch(`${base}/api/gifted/send-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: contact,
            giftUrl: saved.url,
            recipientName,
            senderName,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to send");
        }
        setDesktopSendStatus("sent");
        setLinkShared(true);
        localStorage.setItem("gifted_link_shared", "1");
      } catch {
        try { await navigator.clipboard.writeText(saved.url); } catch { /* ignore */ }
        setDesktopSendStatus("sent");
        setDesktopSendError("sms-fallback");
        setLinkShared(true);
        localStorage.setItem("gifted_link_shared", "1");
      }
    }
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
    localStorage.removeItem("gifted_link_shared");
    setGiftId(null);
    setShareUrl(null);
    setLinkShared(false);
    setPaymentStatus("idle");
    setLocation("/create");
  };

  const displayUrl   = giftId ? `https://gifted.page/open/${giftId}` : "https://gifted.page/open/...";
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
        <div className="hidden md:flex flex-col flex-1 max-w-[240px] self-start">
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
                <div className="flex items-center gap-3 mb-2">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </motion.div>
                  <h1 className="font-serif text-3xl md:text-4xl font-medium">
                    {paymentStatus === "confirming" ? "Confirming…" : "Your gift is ready."}
                  </h1>
                </div>
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

            {/* ── Post-send confirmation ── */}
            <AnimatePresence>
              {(isPaid || (linkShared && !hasBalance)) && (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                        {isPaid ? "Payment received — gift ready!" : "Gift link sent!"}
                      </p>
                      <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-0.5">
                        {recipientName} will see a beautiful reveal when they open it.
                      </p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex items-start gap-0">
                    {[
                      {
                        icon: CheckCircle2,
                        label: isPaid ? "Payment received" : "Link sent",
                        sub: "Done",
                        done: true,
                        color: "#15803d",
                        bg: "#dcfce7",
                      },
                      {
                        icon: Eye,
                        label: `${recipientName} opens it`,
                        sub: "Awaiting",
                        done: false,
                        color: "#6d28d9",
                        bg: "#ede9fe",
                      },
                      ...(isPaid ? [{
                        icon: Sparkles,
                        label: "Balance redeemed",
                        sub: "Awaiting",
                        done: false,
                        color: "hsl(28,62%,36%)",
                        bg: "hsl(28,62%,90%)",
                      }] : []),
                    ].map((step, i, arr) => {
                      const StepIcon = step.icon;
                      return (
                        <React.Fragment key={i}>
                          <div className="flex flex-col items-center gap-1 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: step.done ? step.bg : "hsl(var(--secondary))", color: step.done ? step.color : "hsl(var(--muted-foreground))" }}
                            >
                              <StepIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-center px-1">
                              <p className="text-[10px] font-medium leading-tight" style={{ color: step.done ? step.color : "hsl(var(--muted-foreground))" }}>{step.label}</p>
                              <p className="text-[10px] leading-tight text-muted-foreground/60">{step.sub}</p>
                            </div>
                          </div>
                          {i < arr.length - 1 && (
                            <div className="flex-1 h-px mt-4 mx-1 bg-border" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* CTA — authenticated: phone notification; anonymous: optional sign-up nudge */}
                  {isAuthenticated ? (
                    <div>
                      {!notifySaved ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-green-700/80 dark:text-green-400/80 font-medium">
                            Get a text when {recipientName} opens it
                          </p>
                          <form onSubmit={handleNotifyPhoneSave} className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="tel"
                              value={notifyPhone}
                              onChange={e => setNotifyPhone(e.target.value)}
                              placeholder="Your mobile number"
                              className="flex-1 h-9 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                            />
                            <Button type="submit" size="sm" disabled={!notifyPhone.trim() || notifySaving}
                              className="h-9 px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white border-0 text-xs shrink-0 w-full sm:w-auto">
                              {notifySaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Bell className="w-3 h-3 mr-1.5" /> Notify me</>}
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <p className="text-xs text-green-700/70 dark:text-green-400/70 text-center">
                          ✓ We'll text you when {recipientName} opens and redeems their gift.
                        </p>
                      )}
                    </div>
                  ) : isPaid ? (
                    /* ── Paid gift tracking nudge (unauthenticated sender) ── */
                    <div className="space-y-3 pt-2 border-t border-green-200 dark:border-green-800">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300 pt-1">
                        Want to track when {recipientName} opens and redeems it?
                      </p>
                      <p className="text-xs text-green-700/70 dark:text-green-400/70">
                        Sign in to track this gift.
                      </p>
                      {googleEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (giftId) localStorage.setItem("gifted_auth_return", `/my-gifts?claim=${giftId}`);
                            window.location.href = `${base}/api/auth/google`;
                          }}
                          className="w-full h-10 flex items-center justify-center gap-2.5 rounded-xl border border-green-300 bg-white hover:bg-green-50 dark:border-green-700 dark:bg-green-950/30 dark:hover:bg-green-900/40 transition-colors text-sm font-medium text-green-900 dark:text-green-300"
                        >
                          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2528 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/><path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8586-3.0477.8586-2.3446 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/><path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6554 3.5795 9 3.5795z" fill="#EA4335"/></svg>
                          Sign in with Google
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (!nudgeFormOpen) setNudgeMode("sign-in"); setNudgeFormOpen(v => !v); }}
                        className="w-full text-center text-xs text-green-700/70 dark:text-green-400/70 hover:text-green-800 dark:hover:text-green-300 transition-colors underline underline-offset-2"
                      >
                        {nudgeFormOpen ? "Collapse" : (googleEnabled ? "Or sign in with email" : "Sign in with email")}
                      </button>
                      <AnimatePresence>
                        {nudgeFormOpen && (
                          <motion.form
                            key="paid-nudge-form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            onSubmit={handleNudgeSubmit}
                            className="overflow-hidden space-y-3"
                          >
                            {nudgeMode === "sign-up" && (
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={nudgeFirstName} onChange={e => setNudgeFirstName(e.target.value)} placeholder="First name"
                                  className="h-10 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 transition" />
                                <input type="text" value={nudgeLastName} onChange={e => setNudgeLastName(e.target.value)} placeholder="Last name"
                                  className="h-10 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 transition" />
                              </div>
                            )}
                            <input type="email" value={nudgeEmail} onChange={e => { setNudgeEmail(e.target.value); setNudgeError(null); }}
                              placeholder="Email address" required autoComplete="email"
                              className="w-full h-10 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 transition" />
                            <input type="password" value={nudgePassword} onChange={e => setNudgePassword(e.target.value)}
                              placeholder={nudgeMode === "sign-up" ? "Create a password (min. 8 chars)" : "Password"} required
                              autoComplete={nudgeMode === "sign-in" ? "current-password" : "new-password"}
                              className="w-full h-10 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 transition" />
                            {nudgeError && <p className="text-xs text-destructive">{nudgeError}</p>}
                            <Button type="submit" size="sm" disabled={nudgeSubmitting} className="w-full h-10 rounded-xl text-sm bg-green-700 hover:bg-green-800 border-0">
                              {nudgeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : nudgeMode === "sign-in" ? "Sign in" : "Create account"}
                            </Button>
                            <p className="text-center text-xs text-green-700/70 dark:text-green-400/70">
                              {nudgeMode === "sign-in" ? "New to gifted.? " : "Already have one? "}
                              <button type="button"
                                onClick={() => { setNudgeMode(m => m === "sign-in" ? "sign-up" : "sign-in"); setNudgeError(null); }}
                                className="text-green-800 dark:text-green-300 font-semibold hover:underline"
                              >
                                {nudgeMode === "sign-in" ? "Sign up free" : "Sign in"}
                              </button>
                            </p>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (linkShared && !hasBalance) ? (
                    /* ── Free gift nudge: offer to create account for tracking ── */
                    <div className="space-y-3 pt-2 border-t border-green-200 dark:border-green-800">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300 pt-1">
                        Want to know when {recipientName} opens this?
                      </p>
                      {googleEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (giftId) localStorage.setItem("gifted_auth_return", `/my-gifts?claim=${giftId}`);
                            window.location.href = `${base}/api/auth/google`;
                          }}
                          className="w-full h-10 flex items-center justify-center gap-2.5 rounded-xl border border-green-300 bg-white hover:bg-green-50 dark:border-green-700 dark:bg-green-950/30 dark:hover:bg-green-900/40 transition-colors text-sm font-medium text-green-900 dark:text-green-300"
                        >
                          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2528 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/><path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8586-3.0477.8586-2.3446 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/><path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6554 3.5795 9 3.5795z" fill="#EA4335"/></svg>
                          Sign in with Google
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (!nudgeFormOpen) setNudgeMode("sign-in"); setNudgeFormOpen(v => !v); }}
                        className="w-full text-center text-xs text-green-700/70 dark:text-green-400/70 hover:text-green-800 dark:hover:text-green-300 transition-colors underline underline-offset-2"
                      >
                        {nudgeFormOpen ? "Collapse" : (googleEnabled ? "Or sign in with email" : "Sign in with email")}
                      </button>
                      <AnimatePresence>
                        {nudgeFormOpen && (
                          <motion.form
                            key="nudge-form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            onSubmit={handleNudgeSubmit}
                            className="overflow-hidden space-y-2"
                          >
                            {nudgeMode === "sign-up" && (
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={nudgeFirstName} onChange={e => setNudgeFirstName(e.target.value)} placeholder="First name"
                                  className="h-9 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                                <input type="text" value={nudgeLastName} onChange={e => setNudgeLastName(e.target.value)} placeholder="Last name"
                                  className="h-9 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                              </div>
                            )}
                            <input type="email" value={nudgeEmail} onChange={e => { setNudgeEmail(e.target.value); setNudgeError(null); }}
                              placeholder="Email address" required autoComplete="email"
                              className="w-full h-9 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                            <input type="password" value={nudgePassword} onChange={e => setNudgePassword(e.target.value)}
                              placeholder={nudgeMode === "sign-up" ? "Create a password" : "Password"} required
                              autoComplete={nudgeMode === "sign-in" ? "current-password" : "new-password"}
                              className="w-full h-9 px-3 rounded-xl border border-green-200 dark:border-green-700 bg-white dark:bg-green-950/20 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                            {nudgeError && <p className="text-xs text-destructive">{nudgeError}</p>}
                            <Button type="submit" size="sm" disabled={nudgeSubmitting}
                              className="w-full h-9 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm border-0">
                              {nudgeSubmitting
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : nudgeMode === "sign-in" ? "Sign in & track" : "Create account & track"}
                            </Button>
                            <p className="text-center text-xs text-green-700/60 dark:text-green-400/60">
                              {nudgeMode === "sign-in" ? "New to gifted.? " : "Already have one? "}
                              <button type="button"
                                onClick={() => { setNudgeMode(m => m === "sign-in" ? "sign-up" : "sign-in"); setNudgeError(null); }}
                                className="font-semibold text-green-800 dark:text-green-300 hover:underline">
                                {nudgeMode === "sign-in" ? "Sign up free" : "Sign in"}
                              </button>
                            </p>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* Primary CTA — load balance and send (no login required) */}
            {hasBalance && !isPaid && (
              <Button
                onClick={handlePayAndSend}
                disabled={saving || isRedirecting || authLoading}
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

            {/* ── Share / copy — mobile: native share + copy ── */}
            {(!hasBalance || isPaid) && (
              <div className="flex gap-3 md:hidden">
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

            {/* ── Desktop share section ── */}
            {(!hasBalance || isPaid) && (
              <div className="hidden md:flex flex-col gap-3.5">

                {/* Hero: copy link */}
                <Button
                  onClick={handleCopy}
                  disabled={saving || isRedirecting}
                  className="w-full h-12 rounded-2xl text-sm font-semibold shadow-lg shadow-primary/20 gap-2"
                >
                  {copied
                    ? <><Check className="w-4 h-4" /> Link copied!</>
                    : <><Copy className="w-4 h-4" /> Copy gift link</>}
                </Button>

                <p className="text-xs text-center text-muted-foreground leading-relaxed px-2">
                  Paste it in iMessage or WhatsApp from your phone — when it comes from you, they'll open it.
                </p>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground/70 font-medium">or send via gifted.</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Secondary: platform SMS with honest label */}
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2.5">
                  <p className="text-xs text-muted-foreground">
                    We'll text it — arrives from gifted.'s number, not yours
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={desktopContact}
                      onChange={(e) => {
                        setDesktopContact(e.target.value);
                        setDesktopSendStatus("idle");
                        setDesktopSendError(null);
                      }}
                      placeholder="+1 555 000 0000"
                      className="flex-1 h-10 rounded-xl border border-border bg-background px-3.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      onKeyDown={(e) => { if (e.key === "Enter") handleDesktopSend(); }}
                      disabled={desktopSendStatus === "sending" || desktopSendStatus === "sent"}
                    />
                    <Button
                      variant="outline"
                      onClick={handleDesktopSend}
                      disabled={!desktopContact.trim() || desktopSendStatus === "sending" || desktopSendStatus === "sent" || saving}
                      className="h-10 px-4 rounded-xl text-sm font-medium shrink-0"
                    >
                      {desktopSendStatus === "sending"
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : desktopSendStatus === "sent"
                          ? <><Check className="w-4 h-4 mr-1" /> Sent</>
                          : <><Send className="w-4 h-4 mr-1.5" /> Send text</>}
                    </Button>
                  </div>
                  {desktopSendStatus === "sent" && (
                    <p className="text-xs text-green-600 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {desktopSendError === "sms-fallback"
                        ? `Link copied — paste it in a message to ${recipientName}`
                        : `Text sent to ${desktopContact}`}
                    </p>
                  )}
                </div>

                {/* QR code — tertiary */}
                {shareUrl && (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowQr(v => !v)}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      {showQr ? "Hide QR code" : "Show QR code"}
                    </button>
                    {showQr && <QRCodeDisplay url={shareUrl} label="Scan to open the gift" />}
                  </div>
                )}

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

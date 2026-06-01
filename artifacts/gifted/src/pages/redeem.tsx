import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowLeft, Loader2, ShieldCheck, RefreshCw, Lock, Gift, Sparkles, Clock, X, UserPlus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

type RedeemScreen = "otp-gate" | "otp-sent" | "banking" | "success";
type PayoutMethod = "venmo" | "paypal" | "zelle" | "cashapp";

const METHODS: {
  id: PayoutMethod;
  label: string;
  placeholder: string;
  handleLabel: string;
  color: string;
  selectedBg: string;
  selectedText: string;
  selectedBorder: string;
}[] = [
  {
    id: "venmo",
    label: "Venmo",
    placeholder: "@username",
    handleLabel: "Venmo Username",
    color: "#008CFF",
    selectedBg: "bg-[#008CFF]/10",
    selectedText: "text-[#008CFF]",
    selectedBorder: "border-[#008CFF]",
  },
  {
    id: "cashapp",
    label: "Cash App",
    placeholder: "$cashtag",
    handleLabel: "Cash App $Cashtag",
    color: "#00D64F",
    selectedBg: "bg-[#00D64F]/10",
    selectedText: "text-[#00D64F]",
    selectedBorder: "border-[#00D64F]",
  },
  {
    id: "paypal",
    label: "PayPal",
    placeholder: "you@email.com",
    handleLabel: "PayPal Email",
    color: "#003087",
    selectedBg: "bg-[#003087]/10",
    selectedText: "text-[#003087]",
    selectedBorder: "border-[#003087]",
  },
  {
    id: "zelle",
    label: "Zelle",
    placeholder: "Phone or email",
    handleLabel: "Zelle Phone or Email",
    color: "#6D1ED4",
    selectedBg: "bg-[#6D1ED4]/10",
    selectedText: "text-[#6D1ED4]",
    selectedBorder: "border-[#6D1ED4]",
  },
];

export default function RedeemPage() {
  const [, setLocation]                     = useLocation();
  const [screen, setScreen]                 = useState<RedeemScreen>("otp-gate");
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [payoutName, setPayoutName]         = useState("");
  const [payoutHandle, setPayoutHandle]     = useState("");
  const [amount, setAmount]                 = useState<string>("0");
  const [giftId, setGiftId]                 = useState<string | null>(null);
  const [senderName, setSenderName]         = useState<string | null>(null);
  const [recipientName, setRecipientName]   = useState<string | null>(null);
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked,     setAuthChecked]     = useState(false);
  const [googleEnabled,   setGoogleEnabled]   = useState(false);
  const [nudgeDismissed,  setNudgeDismissed]  = useState(false);
  const [nudgeDone,       setNudgeDone]       = useState(false);
  const [nudgeMode,       setNudgeMode]       = useState<"sign-up" | "sign-in">("sign-up");
  const [nudgeEmail,      setNudgeEmail]      = useState("");
  const [nudgePassword,   setNudgePassword]   = useState("");
  const [nudgeFirstName,  setNudgeFirstName]  = useState("");
  const [nudgeLastName,   setNudgeLastName]   = useState("");
  const [nudgeSubmitting, setNudgeSubmitting] = useState(false);
  const [nudgeError,      setNudgeError]      = useState<string | null>(null);
  const [emailFormOpen,   setEmailFormOpen]   = useState(false);

  const [otpLoading, setOtpLoading]         = useState(false);
  const [otpError, setOtpError]             = useState<string | null>(null);
  const [otpCode, setOtpCode]               = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-filled support email so every help request includes gift context
  const supportHref = `mailto:help@gifted.page?subject=${encodeURIComponent(
    `Redemption help — gift ${giftId ?? "unknown"}`
  )}&body=${encodeURIComponent(
    `Hi gifted. team,\n\nI'm having trouble redeeming my gift.\n\nGift ID: ${giftId ?? "unknown"}\nAmount: $${parseFloat(amount || "0").toFixed(2)}${senderName ? `\nFrom: ${senderName}` : ""}\n\n[Please describe your issue here]\n`
  )}`;

  useEffect(() => {
    const stored = localStorage.getItem("gifted_amount");
    if (stored) setAmount(stored);
    const sn = localStorage.getItem("gifted_sender_name");
    if (sn) setSenderName(sn);

    const urlGiftId = new URLSearchParams(window.location.search).get("giftId");
    const storedId = urlGiftId || localStorage.getItem("gifted_open_gift_id") || localStorage.getItem("gifted_gift_id");
    if (storedId) {
      setGiftId(storedId);
      fetch(`${BASE}/api/gifted/gifts/${encodeURIComponent(storedId)}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(gift => {
          if (!gift) return;
          if (gift.redeemedAt) {
            const justRedeemed = localStorage.getItem("gifted_just_redeemed") === "1";
            if (justRedeemed) {
              // This user just redeemed (possibly returning from Google OAuth).
              // Show the success screen — the auth check will handle linking.
              setScreen("success");
            } else {
              setAlreadyRedeemed(true);
            }
            // Don't run the OTP/banking screen logic below
            return;
          }
          if (gift.recipientName) {
            setRecipientName(gift.recipientName);
            setPayoutName((prev) => prev || gift.recipientName);
          }
          // If no phone on file, or already verified in a previous session, skip OTP gate
          if (!gift.hasRecipientPhone || gift.redemptionVerified) {
            setScreen("banking");
          }
        })
        .catch(() => {});
    }

    // Check auth status — used to auto-link gift after Google OAuth return and to hide nudge
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        const authed = !!user?.id;
        setIsAuthenticated(authed);
        setAuthChecked(true);
        if (authed) {
          setNudgeDone(true);
          // Handle Google OAuth return: flag was set before redirecting, now link the gift
          const pendingId = localStorage.getItem("gifted_gift_id");
          if (pendingId && localStorage.getItem("gifted_just_redeemed") === "1") {
            localStorage.removeItem("gifted_just_redeemed");
            fetch(`${BASE}/api/gifted/gifts/${encodeURIComponent(pendingId)}/save-received`, {
              method: "PATCH",
              credentials: "include",
            }).catch(() => {});
            setScreen("success");
            setTimeout(() => setLocation("/my-gifts"), 1800);
          }
        }
      })
      .catch(() => setAuthChecked(true));

    // Check Google OAuth availability
    // (auth bypass for logged-in users is handled in a separate useEffect below)
    fetch(`${BASE}/api/auth/google/enabled`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.enabled) setGoogleEnabled(true); })
      .catch(() => {});

    // Pre-fill payout method/handle from profile for authenticated users
    fetch(`${BASE}/api/gifted/profile`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((profile: { payoutMethod: string | null; payoutHandle: string | null } | null) => {
        if (!profile) return;
        if (profile.payoutMethod) {
          const method = profile.payoutMethod as PayoutMethod;
          if (METHODS.find(m => m.id === method)) {
            setSelectedMethod(prev => prev ?? method);
          }
        }
        if (profile.payoutHandle) {
          setPayoutHandle(prev => prev || profile.payoutHandle!);
        }
      })
      .catch(() => {});
  }, []);

  // Authenticated users skip the OTP gate entirely — we already know who they are.
  useEffect(() => {
    if (authChecked && isAuthenticated && screen === "otp-gate" && !alreadyRedeemed) {
      setScreen("banking");
    }
  }, [authChecked, isAuthenticated, screen, alreadyRedeemed]);

  const displayAmount = parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : null;
  const activeMethod  = METHODS.find(m => m.id === selectedMethod);

  const startCooldown = () => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!giftId) {
      setOtpError("Gift ID not found. Please open this gift via your original link.");
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${BASE}/api/gifted/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setScreen("otp-sent");
      setOtpCode(["", "", "", "", "", ""]);
      startCooldown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setOtpError(err.message || "Could not send verification code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpCode];
    next[index] = value.slice(-1);
    setOtpCode(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== "") && next.join("").length === 6) {
      handleVerifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalCode = code ?? otpCode.join("");
    if (finalCode.length !== 6) { setOtpError("Please enter the full 6-digit code."); return; }
    if (!giftId) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch(`${BASE}/api/gifted/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId, code: finalCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect code");
      setScreen("banking");
    } catch (err: any) {
      setOtpError(err.message || "Incorrect code. Please try again.");
      setOtpCode(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleCashOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);
    try {
      if (giftId) {
        await fetch(`${BASE}/api/gifted/gifts/${encodeURIComponent(giftId)}/save-received`, {
          method: "PATCH",
          credentials: "include",
        }).catch(() => {});

        const res = await fetch(`${BASE}/api/gifted/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            giftId,
            payoutName,
            payoutMethod: selectedMethod,
            payoutHandle,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Redeem request failed");
      }
      trackEvent("gift_redeemed", {
        method: selectedMethod ?? undefined,
        value:  parseFloat(amount) || 0,
        currency: "USD",
      });
      localStorage.setItem("gifted_just_redeemed", "1");
      setScreen("success");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again or contact help@gifted.page.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNudgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNudgeError(null);
    setNudgeSubmitting(true);
    const endpoint = nudgeMode === "sign-in" ? "/api/auth/login" : "/api/auth/register";
    const body: Record<string, string> = { email: nudgeEmail, password: nudgePassword };
    if (nudgeMode === "sign-up") { body.firstName = nudgeFirstName; body.lastName = nudgeLastName; }
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
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
      if (giftId) {
        await fetch(`${BASE}/api/gifted/gifts/${encodeURIComponent(giftId)}/save-received`, {
          method: "PATCH",
          credentials: "include",
        }).catch(() => {});
      }
      localStorage.removeItem("gifted_just_redeemed");
      setNudgeDone(true);
      setIsAuthenticated(true);
      setTimeout(() => setLocation(nudgeMode === "sign-up" ? "/add-occasion?from=signup" : "/my-gifts"), 1800);
    } catch {
      setNudgeError("Unable to connect. Please try again.");
    } finally {
      setNudgeSubmitting(false);
    }
  };

  if (alreadyRedeemed) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <Gift className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-4xl font-medium mb-3">Already redeemed</h1>
        <p className="text-muted-foreground max-w-sm mb-8">
          This moment has already been redeemed. If you think this is a mistake, please contact{" "}
          <a href={supportHref} className="underline hover:text-foreground">help@gifted.page</a>.
        </p>
        <Link href={giftId ? `/open/${giftId}` : "/"}>
          <Button variant="outline" className="rounded-full h-12 px-8">Back to moment</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pt-10 pb-24 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto w-full">

        <Link href={giftId ? `/open/${giftId}` : "/"} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-10 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to moment
        </Link>

        <AnimatePresence mode="wait">

          {/* ── OTP Gate ── */}
          {screen === "otp-gate" && displayAmount && (
            <motion.div
              key="otp-gate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-lg mx-auto space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-5xl font-medium">Verify to claim</h1>
                <p className="text-lg text-muted-foreground max-w-sm mx-auto">
                  To protect the{" "}
                  <span className="font-semibold text-foreground">${displayAmount}</span>{" "}
                  balance, we need to confirm you're the intended recipient.
                </p>
              </div>

              <div className="bg-card border border-border rounded-[2rem] p-8 space-y-6">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    We'll send a one-time code to the phone number on file.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This is the number the sender entered when creating your moment. The code expires in 10 minutes.
                  </p>
                </div>

                {otpError && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 space-y-1.5">
                    <p>{otpError}</p>
                    <p className="text-xs text-destructive/80">
                      Need help?{" "}
                      <a href={supportHref} className="underline font-medium hover:opacity-80">
                        Email us at help@gifted.page →
                      </a>
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="w-full h-13 rounded-full text-base"
                >
                  {otpLoading
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending…</>
                    : "Send verification code"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Wrong number or having trouble?{" "}
                  <a href={supportHref} className="underline hover:text-foreground transition-colors">
                    Email us
                  </a>
                  {" "}and we'll verify you another way.
                </p>

                <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center">
                  <p className="text-sm text-foreground leading-relaxed">
                    By tapping this button, I agree to receive a text message from <strong>gifted.</strong> (gifted.page) for identity verification. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for info. 1 message per redemption.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── OTP Entry ── */}
          {screen === "otp-sent" && displayAmount && (
            <motion.div
              key="otp-sent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-lg mx-auto space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-5xl font-medium">Check your phone</h1>
                <p className="text-lg text-muted-foreground max-w-sm mx-auto">
                  Enter the 6-digit code we just sent you.
                </p>
              </div>

              <div className="bg-card border border-border rounded-[2rem] p-8 space-y-6">
                <div className="flex gap-2 sm:gap-3 justify-center">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-10 sm:w-12 h-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none transition-colors"
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="text-sm text-destructive text-center bg-destructive/10 rounded-xl px-4 py-3 space-y-1.5">
                    <p>{otpError}</p>
                    <p className="text-xs text-destructive/80">
                      Need help?{" "}
                      <a href={supportHref} className="underline font-medium hover:opacity-80">
                        Email us at help@gifted.page →
                      </a>
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => handleVerifyOtp()}
                  disabled={otpLoading || otpCode.join("").length < 6}
                  className="w-full h-13 rounded-full text-base"
                >
                  {otpLoading
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying…</>
                    : "Verify code"}
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={resendCooldown > 0 || otpLoading}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                  <a
                    href={supportHref}
                    className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                  >
                    Need help?
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Banking form ── */}
          {screen === "banking" && displayAmount && (
            <motion.div
              key="banking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Desktop two-column / Mobile single-column */}
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 lg:items-start">

                {/* ── Left: Context card ── */}
                <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-10">
                  <div className="rounded-[2rem] border border-border bg-card p-8 flex flex-col items-center text-center gap-3 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-4xl font-serif font-medium">${displayAmount}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {senderName
                          ? <>from <span className="font-semibold text-foreground">{senderName}</span></>
                          : "ready to claim"}
                      </p>
                    </div>
                    <div className="w-full border-t border-border pt-4 mt-1">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground text-left">
                        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>We'll send your balance directly — usually within a few hours. Questions? <a href={supportHref} className="underline hover:text-foreground">help@gifted.page</a></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Right: Payout form ── */}
                <div className="flex-1 min-w-0">
                  <div className="mb-6 lg:mb-8">
                    <h1 className="font-serif text-4xl sm:text-5xl font-medium mb-2">Where should we send it?</h1>
                    <p className="text-muted-foreground">Pick the app you already use — we'll send the money directly.</p>
                  </div>

                  <div className="bg-card border border-border rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">

                    {/* Method picker */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {METHODS.map((method) => {
                        const isSelected = selectedMethod === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => { setSelectedMethod(method.id); setPayoutHandle(""); }}
                            className={`relative p-3.5 rounded-2xl border-2 text-center transition-all font-semibold text-sm flex flex-col items-center gap-2 ${
                              isSelected
                                ? `${method.selectedBg} ${method.selectedText} ${method.selectedBorder}`
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            {/* Brand dot */}
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: method.color, opacity: isSelected ? 1 : 0.5 }}
                            />
                            {method.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Form fields */}
                    <AnimatePresence>
                      {selectedMethod && activeMethod && (
                        <motion.form
                          key={selectedMethod}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden space-y-5 pt-4 border-t border-border"
                          onSubmit={handleCashOut}
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Your Name</Label>
                              <Input
                                placeholder="e.g. Sarah Connor"
                                className="h-12 rounded-xl"
                                value={payoutName}
                                onChange={(e) => setPayoutName(e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{activeMethod.handleLabel}</Label>
                              <Input
                                placeholder={activeMethod.placeholder}
                                className="h-12 rounded-xl"
                                value={payoutHandle}
                                onChange={(e) => setPayoutHandle(e.target.value)}
                                required
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                              />
                            </div>
                          </div>

                          {error && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                              {error}
                            </div>
                          )}

                          <Button
                            type="submit"
                            size="lg"
                            disabled={isProcessing}
                            className="w-full h-14 rounded-full text-lg shadow-lg"
                          >
                            {isProcessing
                              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                              : `Send Me $${displayAmount}`}
                          </Button>
                        </motion.form>
                      )}
                    </AnimatePresence>

                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── No balance ── */}
          {!displayAmount && screen !== "success" && (
            <motion.div
              key="no-balance"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-lg mx-auto mt-4"
            >
              <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl flex flex-col items-center text-center gap-6">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.5, type: "spring", stiffness: 200, damping: 14 }}
                >
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Gift className="w-12 h-12 text-primary" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="space-y-3"
                >
                  <h1 className="font-serif text-4xl font-medium">This one was all love.</h1>
                  <p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    No balance to collect — just a moment someone built for you. That's the whole gift.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 w-full"
                >
                  <Link href={giftId ? `/open/${giftId}` : "/"} className="flex-1">
                    <Button className="w-full rounded-full h-12">
                      Back to my moment
                    </Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full rounded-full h-12">
                      Go home
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {screen === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-lg mx-auto mt-4"
            >
              {/* Hero card */}
              <div className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl flex flex-col items-center text-center gap-6">

                {/* Animated checkmark */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.5, type: "spring", stiffness: 200, damping: 14 }}
                  className="relative"
                >
                  <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                  </div>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                  </motion.div>
                </motion.div>

                {/* Amount + heading */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="space-y-2"
                >
                  <p className="font-serif text-5xl font-medium text-foreground">
                    ${displayAmount}
                  </p>
                  <h2 className="font-serif text-2xl font-medium text-foreground">
                    Your payout is confirmed.
                  </h2>
                  {activeMethod && (
                    <p className="text-base text-muted-foreground">
                      Heading to your <span className="font-semibold text-foreground">{activeMethod.label}</span> — same day.
                    </p>
                  )}
                </motion.div>

                {/* Status rows */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="w-full space-y-3 pt-2 border-t border-border"
                >
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Payout request received</p>
                      <p className="text-xs text-muted-foreground">The gifted. team has your details</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Transfer in progress</p>
                      <p className="text-xs text-muted-foreground">Expected same day</p>
                    </div>
                  </div>
                </motion.div>

                {/* ── Send a moment CTA ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                  className="w-full text-center"
                >
                  <p className="text-sm text-muted-foreground">
                    Loved the experience?{" "}
                    <a
                      href="/features"
                      className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                    >
                      Send a moment like this.
                    </a>
                  </p>
                </motion.div>

                {/* ── Account nudge ── */}
                {!nudgeDismissed && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="w-full"
                  >
                    {nudgeDone ? (
                      <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                          Gift linked to your account — track it anytime in your dashboard.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <UserPlus className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">Track your payout</p>
                              <p className="text-[11px] text-muted-foreground">Create a free account to see when it arrives.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setNudgeDismissed(true); localStorage.removeItem("gifted_just_redeemed"); }}
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
                            aria-label="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Google button */}
                        {googleEnabled && (
                          <button
                            type="button"
                            onClick={() => {
                              const returnTo = window.location.pathname + window.location.search;
                              window.location.href = `${BASE}/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
                            }}
                            className="w-full h-10 flex items-center justify-center gap-2.5 rounded-xl border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium text-foreground"
                          >
                            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2528 17.64 11.9455 17.64 9.2045z" fill="#4285F4"/><path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8586-3.0477.8586-2.3446 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/><path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1632 6.6554 3.5795 9 3.5795z" fill="#EA4335"/></svg>
                            Continue with Google
                          </button>
                        )}

                        {/* Collapsible email form */}
                        <button
                          type="button"
                          onClick={() => setEmailFormOpen(v => !v)}
                          className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
                        >
                          {emailFormOpen ? "Collapse" : (googleEnabled ? "Or continue with email" : "Continue with email")}
                        </button>
                        <AnimatePresence>
                          {emailFormOpen && (
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
                                    className="h-9 px-3 rounded-xl border border-border bg-background text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
                                  <input type="text" value={nudgeLastName} onChange={e => setNudgeLastName(e.target.value)} placeholder="Last name"
                                    className="h-9 px-3 rounded-xl border border-border bg-background text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
                                </div>
                              )}
                              <input type="email" value={nudgeEmail} onChange={e => { setNudgeEmail(e.target.value); setNudgeError(null); }}
                                placeholder="Email address" required autoComplete="email"
                                className="w-full h-9 px-3 rounded-xl border border-border bg-background text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
                              <input type="password" value={nudgePassword} onChange={e => setNudgePassword(e.target.value)}
                                placeholder={nudgeMode === "sign-up" ? "Create a password (min. 8 chars)" : "Password"} required
                                autoComplete={nudgeMode === "sign-in" ? "current-password" : "new-password"}
                                className="w-full h-9 px-3 rounded-xl border border-border bg-background text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
                              {nudgeError && <p className="text-[11px] text-destructive">{nudgeError}</p>}
                              <Button type="submit" size="sm" disabled={nudgeSubmitting} className="w-full h-9 rounded-xl text-xs">
                                {nudgeSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nudgeMode === "sign-in" ? "Sign in" : "Create account"}
                              </Button>
                              <p className="text-[11px] text-center text-muted-foreground/60">
                                {nudgeMode === "sign-in" ? "New to gifted.? " : "Already have an account? "}
                                <button type="button" onClick={() => { setNudgeMode(m => m === "sign-in" ? "sign-up" : "sign-in"); setNudgeError(null); }}
                                  className="underline underline-offset-2 hover:text-foreground transition-colors">
                                  {nudgeMode === "sign-in" ? "Sign up free" : "Sign in"}
                                </button>
                              </p>
                            </motion.form>
                          )}
                        </AnimatePresence>

                        <button
                          type="button"
                          onClick={() => { setNudgeDismissed(true); localStorage.removeItem("gifted_just_redeemed"); }}
                          className="w-full text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          Skip — I don't need an account
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Support note */}
                <p className="text-xs text-muted-foreground/70">
                  Questions? <a href={supportHref} className="underline hover:text-foreground transition-colors">help@gifted.page</a>
                </p>

                <Button
                  variant="outline"
                  className="rounded-full h-11 px-8 w-full sm:w-auto"
                  onClick={() => setLocation("/")}
                >
                  Back to home
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

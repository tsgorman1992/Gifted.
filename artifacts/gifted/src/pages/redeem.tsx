import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowLeft, Loader2, ShieldCheck, RefreshCw, Lock, Gift } from "lucide-react";

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
  const [screen, setScreen]                 = useState<RedeemScreen>("banking"); // OTP bypassed temporarily — restore to "otp-gate" once Twilio toll-free is verified
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

  const [otpLoading, setOtpLoading]         = useState(false);
  const [otpError, setOtpError]             = useState<string | null>(null);
  const [otpCode, setOtpCode]               = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("gifted_amount");
    if (stored) setAmount(stored);
    const sn = localStorage.getItem("gifted_sender_name");
    if (sn) setSenderName(sn);

    const storedId = localStorage.getItem("gifted_gift_id");
    if (storedId) {
      setGiftId(storedId);
      fetch(`${BASE}/api/gifted/gifts/${encodeURIComponent(storedId)}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(gift => {
          if (!gift) return;
          if (gift.redeemedAt) setAlreadyRedeemed(true);
          if (gift.recipientName) {
            setRecipientName(gift.recipientName);
            setPayoutName((prev) => prev || gift.recipientName);
          }
        })
        .catch(() => {});
    }
  }, []);

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
      setScreen("success");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again or contact help@gifted.page.");
    } finally {
      setIsProcessing(false);
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
          This gift has already been redeemed. If you think this is a mistake, please contact{" "}
          <a href="mailto:help@gifted.page" className="underline hover:text-foreground">help@gifted.page</a>.
        </p>
        <Link href={giftId ? `/open/${giftId}` : "/"}>
          <Button variant="outline" className="rounded-full h-12 px-8">Back to gift</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pt-10 pb-24 px-5 sm:px-8">
      <div className="max-w-5xl mx-auto w-full">

        <Link href={giftId ? `/open/${giftId}` : "/"} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-10 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to gift
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
                <h1 className="font-serif text-5xl font-medium">Verify to Claim</h1>
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
                    This is the number the sender entered when creating your gift. The code expires in 10 minutes.
                  </p>
                </div>

                {otpError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{otpError}</p>
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
                  <p className="text-sm text-destructive text-center bg-destructive/10 rounded-xl px-4 py-3">{otpError}</p>
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

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={resendCooldown > 0 || otpLoading}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
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
                        <span>We'll send your balance directly — usually within a few hours. Questions? <a href="mailto:help@gifted.page" className="underline hover:text-foreground">help@gifted.page</a></span>
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-6 mt-12"
            >
              <h1 className="font-serif text-5xl font-medium">Cash Out</h1>
              <p className="text-xl text-muted-foreground">No balance attached — enjoy the gift!</p>
              <Link href="/">
                <Button variant="outline" className="rounded-full h-12 px-8">Back to home</Button>
              </Link>
            </motion.div>
          )}

          {/* ── Success ── */}
          {screen === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto text-center bg-card rounded-[2.5rem] p-12 border border-border shadow-xl flex flex-col items-center mt-8"
            >
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-8">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="font-serif text-4xl font-medium mb-4">You're all set!</h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto mb-3">
                We'll send your <span className="font-semibold text-foreground">${displayAmount}</span>
                {activeMethod && <> to your {activeMethod.label}</>}
                {" "}— usually within a few hours.
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-10">
                Questions? Reach us at <a href="mailto:help@gifted.page" className="underline">help@gifted.page</a>
              </p>
              <Button variant="outline" className="rounded-full h-12 px-8" onClick={() => setLocation("/")}>
                Return to home
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

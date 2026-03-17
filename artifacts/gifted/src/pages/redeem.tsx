import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CreditCard, CheckCircle2, ArrowLeft, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

type RedeemScreen = "otp-gate" | "otp-sent" | "banking" | "success";

export default function RedeemPage() {
  const [screen, setScreen]                 = useState<RedeemScreen>("otp-gate");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [amount, setAmount]                 = useState<string>("0");
  const [giftId, setGiftId]                 = useState<string | null>(null);

  const [otpLoading, setOtpLoading]         = useState(false);
  const [otpError, setOtpError]             = useState<string | null>(null);
  const [otpCode, setOtpCode]               = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("gifted_amount");
    if (stored) setAmount(stored);
    const storedId = localStorage.getItem("gifted_gift_id");
    if (storedId) setGiftId(storedId);
  }, []);

  const displayAmount = parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : null;

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
          body: JSON.stringify({ giftId }),
        });
        if (!res.ok) throw new Error("Redeem request failed");
      }
      setScreen("success");
    } catch {
      setError("Something went wrong. Please try again or contact help@gifted.page.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pt-12 pb-24 px-6">
      <div className="max-w-2xl mx-auto w-full">

        <Link href="/reveal" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
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
              className="space-y-10"
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
              className="space-y-10"
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
                <div className="flex gap-3 justify-center">
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
                      className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none transition-colors"
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
              className="space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="font-serif text-5xl font-medium">Cash Out</h1>
                <p className="text-xl text-muted-foreground">
                  You have{" "}
                  <span className="font-bold text-foreground">${displayAmount}</span>{" "}
                  available to withdraw.
                </p>
              </div>

              <div className="bg-card border border-border rounded-[2rem] p-6 md:p-10 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Select Payout Method</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("debit")}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                      selectedMethod === "debit" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className={`w-8 h-8 ${selectedMethod === "debit" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold">Debit Card</p>
                      <p className="text-sm text-muted-foreground">Instant transfer, ~30 min</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod("bank")}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                      selectedMethod === "bank" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Building2 className={`w-8 h-8 ${selectedMethod === "bank" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold">Bank Account</p>
                      <p className="text-sm text-muted-foreground">ACH transfer, 1–3 days</p>
                    </div>
                  </button>
                </div>

                <AnimatePresence>
                  {selectedMethod && (
                    <motion.form
                      key={selectedMethod}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden space-y-6 pt-4 border-t border-border"
                      onSubmit={handleCashOut}
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Legal Name</Label>
                          <Input placeholder="e.g. Sarah Connor" className="h-12 rounded-xl" required />
                        </div>
                        {selectedMethod === "debit" ? (
                          <>
                            <div className="space-y-2">
                              <Label>Debit Card Number</Label>
                              <Input placeholder="•••• •••• •••• ••••" className="h-12 rounded-xl" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Expiry</Label>
                                <Input placeholder="MM / YY" className="h-12 rounded-xl" required />
                              </div>
                              <div className="space-y-2">
                                <Label>CVC</Label>
                                <Input placeholder="•••" className="h-12 rounded-xl" required />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Routing Number</Label>
                              <Input placeholder="9-digit routing number" className="h-12 rounded-xl" required />
                            </div>
                            <div className="space-y-2">
                              <Label>Account Number</Label>
                              <Input placeholder="Account number" className="h-12 rounded-xl" required />
                            </div>
                          </>
                        )}
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
                          ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing…</>
                          : `Transfer $${displayAmount}`}
                      </Button>

                      <p className="text-center text-xs text-muted-foreground">
                        Payouts are processed securely via Stripe. No expiry. No hidden fees.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
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
              className="text-center bg-card rounded-[2.5rem] p-12 border border-border shadow-xl flex flex-col items-center mt-12"
            >
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-8">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="font-serif text-4xl font-medium mb-4">Transfer Initiated</h2>
              <p className="text-lg text-muted-foreground max-w-md mx-auto mb-10">
                {selectedMethod === "debit"
                  ? `Your $${displayAmount} should arrive within 30 minutes.`
                  : `Your $${displayAmount} will arrive in 1–3 business days.`}
              </p>
              <Button variant="outline" className="rounded-full h-12 px-8" onClick={() => (window.location.href = "/")}>
                Return to home
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

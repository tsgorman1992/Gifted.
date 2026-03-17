import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";

export default function RedeemPage() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [amount, setAmount] = useState<string>("0");

  useEffect(() => {
    const stored = localStorage.getItem("gifted_amount");
    if (stored) setAmount(stored);
  }, []);

  const displayAmount = parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : null;

  const handleCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col pt-12 pb-24 px-6">
      <div className="max-w-2xl mx-auto w-full">

        <Link href="/reveal" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-12 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to gift
        </Link>

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-10"
            >
              <div className="text-center space-y-4">
                <h1 className="font-serif text-5xl font-medium">Cash Out</h1>
                {displayAmount ? (
                  <p className="text-xl text-muted-foreground">
                    You have <span className="font-bold text-foreground">${displayAmount}</span> available to withdraw.
                  </p>
                ) : (
                  <p className="text-xl text-muted-foreground">
                    No balance attached — enjoy the gift!
                  </p>
                )}
              </div>

              {displayAmount && (
                <div className="bg-card border border-border rounded-[2rem] p-6 md:p-10 shadow-sm">
                  <h3 className="text-lg font-bold mb-6">Select Payout Method</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod("debit")}
                      className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                        selectedMethod === "debit"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <CreditCard className={`w-8 h-8 ${selectedMethod === "debit" ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <h4 className="font-bold">Debit Card</h4>
                        <p className="text-sm text-muted-foreground">Arrives within ~30 minutes</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod("bank")}
                      className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                        selectedMethod === "bank"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Building2 className={`w-8 h-8 ${selectedMethod === "bank" ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <h4 className="font-bold">Bank Transfer</h4>
                        <p className="text-sm text-muted-foreground">1–3 business days</p>
                      </div>
                    </button>
                  </div>

                  <AnimatePresence>
                    {selectedMethod && (
                      <motion.form
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
                            <div className="space-y-2">
                              <Label>Debit Card Number</Label>
                              <Input placeholder="•••• •••• •••• ••••" className="h-12 rounded-xl" required />
                            </div>
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

                        <Button
                          type="submit"
                          size="lg"
                          disabled={isProcessing}
                          className="w-full h-14 rounded-full text-lg shadow-lg"
                        >
                          {isProcessing ? "Processing…" : `Transfer $${displayAmount}`}
                        </Button>

                        <p className="text-center text-xs text-muted-foreground">
                          Payouts are processed securely via Stripe. No expiry. No hidden fees.
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {!displayAmount && (
                <div className="text-center">
                  <Link href="/">
                    <Button variant="outline" className="rounded-full h-12 px-8">
                      Back to home
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          ) : (
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

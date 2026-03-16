import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Smartphone, CheckCircle2, ArrowLeft } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";

export default function RedeemPage() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate network request
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
                <p className="text-xl text-muted-foreground">
                  You have <span className="font-bold text-foreground">${mockGiftData.amount}</span> available.
                </p>
              </div>

              <div className="bg-card border border-border rounded-[2rem] p-6 md:p-10 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Select Payout Method</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('venmo')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                      selectedMethod === 'venmo' 
                        ? 'border-[#008CFF] bg-[#008CFF]/5' 
                        : 'border-border hover:border-[#008CFF]/50'
                    }`}
                  >
                    <Smartphone className={`w-8 h-8 ${selectedMethod === 'venmo' ? 'text-[#008CFF]' : 'text-muted-foreground'}`} />
                    <div>
                      <h4 className="font-bold">Venmo</h4>
                      <p className="text-sm text-muted-foreground">Instant transfer</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('bank')}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 ${
                      selectedMethod === 'bank' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Building2 className={`w-8 h-8 ${selectedMethod === 'bank' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <h4 className="font-bold">Bank Transfer</h4>
                      <p className="text-sm text-muted-foreground">1-3 business days</p>
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
                        <div className="space-y-2">
                          <Label>
                            {selectedMethod === 'venmo' ? 'Venmo Username' : 'Routing & Account Number'}
                          </Label>
                          <Input 
                            placeholder={selectedMethod === 'venmo' ? "@username" : "XXXXX-XXXXX"} 
                            className="h-12 rounded-xl" 
                            required 
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        size="lg" 
                        disabled={isProcessing}
                        className="w-full h-14 rounded-full text-lg shadow-lg"
                      >
                        {isProcessing ? "Processing..." : `Transfer $${mockGiftData.amount}`}
                      </Button>
                      
                      <p className="text-center text-xs text-muted-foreground">
                        gifted. balances have no expiry and no hidden fees.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
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
                Your ${mockGiftData.amount} is on its way. It will arrive in your account shortly.
              </p>
              <Button variant="outline" className="rounded-full h-12 px-8" onClick={() => window.location.href="/"}>
                Return to home
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

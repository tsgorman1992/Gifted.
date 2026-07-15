import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Check, Clock, XCircle } from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

interface StatusData {
  yourAmountCents: number;
  yourStatus: "pending" | "paid" | "refunded" | "failed";
  notifyOnOpen: boolean;
  recipientName: string;
  occasion: string;
  campaignStatus: string;
  sentAt: string | null;
  paidCount: number;
  paidTotalCents: number;
}

function formatOccasion(o: string): string {
  return o.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ChipInStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/gifted/group-gifts/contributions/status/${token}`)
      .then(async r => {
        if (r.status === 404) { setStatus("not-found"); return; }
        if (!r.ok) { setStatus("error"); return; }
        setData(await r.json());
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-2">We couldn't find that contribution</h1>
          <p className="text-muted-foreground text-sm">Double-check the link from your confirmation email.</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">Something went wrong loading this status. Please try again.</p>
      </div>
    );
  }

  const amountStr = `$${(data.yourAmountCents / 100).toFixed(2)}`;

  const statusDisplay: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    open: { icon: <Clock className="w-6 h-6" />, label: "Still collecting contributions", color: "text-muted-foreground" },
    sending: { icon: <Loader2 className="w-6 h-6 animate-spin" />, label: "Being sent right now", color: "text-primary" },
    sent: { icon: <Check className="w-6 h-6" />, label: "Delivered", color: "text-primary" },
    canceled: { icon: <XCircle className="w-6 h-6" />, label: "Cancelled — you've been refunded", color: "text-muted-foreground" },
    refunding: { icon: <Loader2 className="w-6 h-6 animate-spin" />, label: "Refund in progress", color: "text-muted-foreground" },
    refunded: { icon: <XCircle className="w-6 h-6" />, label: "Cancelled — you've been refunded", color: "text-muted-foreground" },
  };

  const display = statusDisplay[data.campaignStatus] ?? statusDisplay.open;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Your Chip In</p>
          <h1 className="font-serif text-3xl font-medium mb-2">
            {data.recipientName}'s {formatOccasion(data.occasion)}
          </h1>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className={`flex items-center gap-3 ${display.color}`}>
            {display.icon}
            <span className="text-base font-medium">{display.label}</span>
          </div>

          <div className="border-t border-border pt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your contribution</span>
              <span className="font-semibold">{amountStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{data.yourStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Raised so far</span>
              <span className="font-medium">${(data.paidTotalCents / 100).toFixed(2)} &middot; {data.paidCount} contributor{data.paidCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {data.campaignStatus === "sent" && (
            <p className="text-xs text-center text-muted-foreground border-t border-border pt-5">
              This moment has been delivered.{data.notifyOnOpen ? " We'll email you when it's opened." : ""}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

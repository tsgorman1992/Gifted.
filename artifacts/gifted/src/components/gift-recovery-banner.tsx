import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isGiftSessionStale } from "@/lib/session";

export function GiftRecoveryBanner() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const [giftId] = useState<string | null>(() => {
    if (isGiftSessionStale()) return null;
    if (localStorage.getItem("gifted_link_shared")) return null;
    return (
      localStorage.getItem("gifted_paid_id") ||
      localStorage.getItem("gifted_free_gift_id") ||
      null
    );
  });

  const [recipientName] = useState<string>(
    () => localStorage.getItem("gifted_recipient_name") || "your recipient"
  );

  if (isLoading || isAuthenticated || !giftId || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-primary text-primary-foreground z-50"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLocation("/preview")}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity text-left"
          >
            <span>
              Finish sending your gift to <strong>{recipientName}</strong>
            </span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full hover:bg-primary-foreground/15 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

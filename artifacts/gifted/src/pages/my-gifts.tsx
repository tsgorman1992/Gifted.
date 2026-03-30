import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, ExternalLink, CheckCircle2, Clock, Plus, Copy,
  Check, Sparkles, TrendingUp, Heart, Star,
  DollarSign, Package, Flower2, Snowflake, Sun, Eye, CalendarClock,
  Inbox, Trash2, X, Share2, Send, Users, Bell,
  UserPlus, Cake, Pencil, BookUser,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { clearGiftSession } from "@/lib/session";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GiftSummary {
  id: string;
  recipientName: string;
  senderName: string;
  giftTitle: string;
  occasion: string;
  experience: string;
  amount: string | null;
  paid: boolean;
  openedAt: string | null;
  redeemedAt: string | null;
  reaction: string | null;
  reactionAt: string | null;
  scheduledFor: string | null;
  scheduleDelivered: boolean;
  createdAt: string;
}

interface ReceivedGiftSummary {
  id: string;
  senderName: string;
  recipientName: string;
  giftTitle: string;
  occasion: string;
  experience: string;
  amount: string | null;
  openedAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

interface ContactOccasion {
  id: string;
  contactId: string;
  userId: string;
  label: string;
  month: number;
  day: number;
  lastReminderSentYear: number | null;
  createdAt: string;
}

interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  occasions: ContactOccasion[];
}

// ─── Experience config ────────────────────────────────────────────────────────

const EXPERIENCE_META: Record<string, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  "confetti-burst":  { label: "Confetti Burst",  color: "#e55a5a", bg: "#fef2f2", Icon: Gift },
  "golden-hour":     { label: "Golden Hour",     color: "#c27c2a", bg: "#fffbeb", Icon: Sparkles },
  "garden-bloom":    { label: "Garden Bloom",    color: "#d97d9a", bg: "#fdf2f8", Icon: Flower2 },
  "midnight-stars":  { label: "Midnight Stars",  color: "#6366f1", bg: "#eef2ff", Icon: Star },
  "rose-petal":      { label: "Rose Petal",      color: "#e879a8", bg: "#fdf2f8", Icon: Heart },
  "snow-flurry":     { label: "Snow Flurry",     color: "#0ea5e9", bg: "#f0f9ff", Icon: Snowflake },
  "sunrise":         { label: "Sunrise",         color: "#ea580c", bg: "#fff7ed", Icon: Sun },
  "mothers-day":     { label: "For Mom",         color: "#c77daa", bg: "#fdf2f8", Icon: Flower2 },
  "fathers-day":     { label: "For Dad",         color: "#1e4d8c", bg: "#eff6ff", Icon: Star },
};

const DEFAULT_EXP = { label: "gifted.", color: "hsl(28,62%,36%)", bg: "hsl(28,62%,36%,0.08)", Icon: Gift };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

async function fetchMyGifts(): Promise<GiftSummary[]> {
  const res = await fetch(`${BASE}/api/gifted/my-gifts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load gifts");
  return res.json();
}

async function fetchReceivedGifts(): Promise<ReceivedGiftSummary[]> {
  const res = await fetch(`${BASE}/api/gifted/received-gifts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load received gifts");
  return res.json();
}

async function fetchContacts(): Promise<Contact[]> {
  const res = await fetch(`${BASE}/api/gifted/contacts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load contacts");
  return res.json();
}

type GiftStatus = "draft" | "scheduled" | "ready" | "sent" | "opened" | "redeemed";

function hasBalance(gift: GiftSummary): boolean {
  return !!gift.amount && parseFloat(gift.amount) > 0;
}

function getStatus(gift: GiftSummary): GiftStatus {
  if (gift.redeemedAt && hasBalance(gift)) return "redeemed";
  if (gift.openedAt)   return "opened";
  if (gift.paid && !hasBalance(gift)) return "ready";
  if (gift.paid)       return "sent";
  if (gift.scheduledFor && !gift.scheduleDelivered) return "scheduled";
  return "draft";
}

const STATUS_META: Record<GiftStatus, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { label: "Draft",           color: "#92400e", bg: "#fef3c7", Icon: Clock },
  scheduled: { label: "Scheduled",       color: "#0369a1", bg: "#e0f2fe", Icon: CalendarClock },
  ready:     { label: "Ready to share",  color: "#92400e", bg: "#fef3c7", Icon: Share2 },
  sent:      { label: "Ready",           color: "#92400e", bg: "#fef3c7", Icon: Share2 },
  opened:    { label: "Opened",          color: "#6d28d9", bg: "#ede9fe", Icon: Eye },
  redeemed:  { label: "Redeemed",        color: "#15803d", bg: "#dcfce7", Icon: CheckCircle2 },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function greeting(firstName: string | null) {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${time}, ${firstName}` : time;
}

function daysUntilOccasion(month: number, day: number): number {
  const today = new Date();
  const thisYear = today.getFullYear();
  let target = new Date(thisYear, month - 1, day);
  if (target < today) target = new Date(thisYear + 1, month - 1, day);
  return differenceInDays(target, today);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, Icon, delay }: {
  label: string; value: string | number; sub?: string;
  Icon: React.ComponentType<{ className?: string }>; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p className="font-serif text-3xl font-medium text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

// ─── Resend Button ────────────────────────────────────────────────────────────

function ResendButton({ url, recipientName }: { url: string; recipientName: string }) {
  const [state, setState] = useState<"idle" | "shared" | "copied">("idle");

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator?.share === "function") {
      try {
        await navigator.share({ title: `A gift for ${recipientName}`, url });
        setState("shared");
        setTimeout(() => setState("idle"), 2500);
      } catch {
        // User cancelled — no-op
      }
    } else {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all hover:opacity-80"
      style={{ background: "hsl(28,62%,36%,0.08)", color: "hsl(28,62%,36%)", borderColor: "hsl(28,62%,36%,0.25)" }}
    >
      <AnimatePresence mode="wait">
        {state === "copied" ? (
          <motion.span key="copied" className="flex items-center gap-1.5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <Check className="w-3 h-3 text-green-600" /><span className="text-green-700">Copied!</span>
          </motion.span>
        ) : state === "shared" ? (
          <motion.span key="shared" className="flex items-center gap-1.5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <Check className="w-3 h-3" />Shared
          </motion.span>
        ) : (
          <motion.span key="idle" className="flex items-center gap-1.5" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <Send className="w-3 h-3" />Resend link
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ url, full = false }: { url: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (full) {
    return (
      <button
        onClick={handleCopy}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 text-primary font-medium text-sm hover:bg-primary/20 transition-all"
      >
        <AnimatePresence mode="wait">
          {copied
            ? <motion.span key="check" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><Check className="w-4 h-4 text-green-600" /><span className="text-green-700">Copied!</span></motion.span>
            : <motion.span key="copy" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}><Copy className="w-4 h-4" />Copy gift link</motion.span>
          }
        </AnimatePresence>
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy gift link"
      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
    >
      <AnimatePresence mode="wait">
        {copied
          ? <motion.span key="check" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}><Check className="w-4 h-4 text-green-600" /></motion.span>
          : <motion.span key="copy" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}><Copy className="w-4 h-4" /></motion.span>
        }
      </AnimatePresence>
    </button>
  );
}

// ─── Sent gift card ───────────────────────────────────────────────────────────

function GiftCard({ gift, idx }: { gift: GiftSummary; idx: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);
  const [activeBalanceBlocked, setActiveBalanceBlocked] = useState(false);
  const exp = EXPERIENCE_META[gift.experience] ?? DEFAULT_EXP;
  const status = getStatus(gift);
  const statusMeta = STATUS_META[status];
  const shareUrl = `${window.location.origin}${BASE}/open/${gift.id}`;
  const ExpIcon = exp.Icon;

  function handleCardClick() {
    if (confirmDelete) return;
    setLocation(`/open/${gift.id}?preview=true`);
  }

  const handleHide = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setHideError(null);
    try {
      const res = await fetch(`${BASE}/api/gifted/gifts/${gift.id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 409) {
        setActiveBalanceBlocked(true);
        setIsDeleting(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to hide");
      await queryClient.invalidateQueries({ queryKey: ["my-gifts"] });
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }, [gift.id, queryClient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + idx * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleCardClick}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0" style={{ background: exp.color }} />

        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: exp.bg }}>
                <ExpIcon className="w-4 h-4" style={{ color: exp.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base leading-tight truncate">{gift.giftTitle || `Gift for ${gift.recipientName}`}</p>
                <p className="text-sm text-muted-foreground">
                  For <span className="font-medium text-foreground">{gift.recipientName}</span>
                  {" · "}{gift.occasion}
                </p>
              </div>
            </div>

            {gift.amount && parseFloat(gift.amount) > 0 && (
              <div className="shrink-0 bg-primary/10 text-primary font-semibold text-sm px-3 py-1 rounded-full border border-primary/20">
                ${parseFloat(gift.amount).toFixed(0)}
              </div>
            )}
          </div>

          {gift.reaction && (
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{gift.reaction}</span>
              <span className="text-xs text-muted-foreground">
                {gift.recipientName} reacted
                {gift.reactionAt ? ` ${formatDistanceToNow(new Date(gift.reactionAt), { addSuffix: true })}` : ""}
              </span>
            </div>
          )}

          {!confirmDelete && (status === "ready" || status === "sent") && (
            <div onClick={(e) => e.stopPropagation()}>
              <CopyButton url={shareUrl} full />
            </div>
          )}

          <div className="flex items-center gap-0 text-xs">
            {(() => {
              const isScheduled = !!gift.scheduledFor;
              const giftHasBalance = hasBalance(gift);
              type TimelineStep = "scheduled" | "sent" | "opened" | "redeemed";
              const steps: TimelineStep[] = isScheduled
                ? (giftHasBalance ? ["scheduled", "sent", "opened", "redeemed"] : ["scheduled", "sent", "opened"])
                : (giftHasBalance ? ["sent", "opened", "redeemed"] : ["sent", "opened"]);
              const orderedStatuses: GiftStatus[] = isScheduled
                ? (giftHasBalance ? ["scheduled", "sent", "opened", "redeemed"] : ["scheduled", "sent", "opened"])
                : (giftHasBalance ? ["sent", "opened", "redeemed"] : ["sent", "opened"]);
              const effectiveStatus: GiftStatus = (status === "draft" || status === "scheduled" || status === "ready")
                ? (isScheduled ? "scheduled" : "sent")
                : status;
              const statusIdx = orderedStatuses.indexOf(effectiveStatus);
              const isLastStep = (i: number) => i === steps.length - 1;
              return steps.map((step, i) => {
                const isActiveCurrent = (status === "ready" || status === "sent") && i === 0;
                const done = i <= statusIdx && status !== "draft" && status !== "ready" && !(status === "sent" && i === 0);
                const isFinalCompleted = done && isLastStep(i);
                const StepIcon = isActiveCurrent ? Share2
                  : isFinalCompleted && !giftHasBalance && step === "opened" ? CheckCircle2
                  : STATUS_META[step].Icon;
                const stepColor = isActiveCurrent ? "#92400e"
                  : isFinalCompleted && !giftHasBalance && step === "opened" ? "#15803d"
                  : STATUS_META[step].color;
                const stepBg = isActiveCurrent ? "#fef3c7"
                  : isFinalCompleted && !giftHasBalance && step === "opened" ? "#dcfce7"
                  : STATUS_META[step].bg;
                const isNextPending = !done && !isActiveCurrent && i === statusIdx + 1 && (status === "sent" || status === "ready");
                const label = isActiveCurrent ? "Ready"
                  : step === "scheduled" ? "Scheduled"
                  : step === "sent" ? "Ready"
                  : step === "opened" ? "Opened"
                  : "Redeemed";
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="relative">
                        {isNextPending && (
                          <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: stepColor }} />
                        )}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors relative"
                          style={{
                            background: (done || isActiveCurrent) ? stepBg : "hsl(var(--secondary))",
                            color: (done || isActiveCurrent) ? stepColor : "hsl(var(--muted-foreground))",
                            opacity: isNextPending ? 0.45 : 1,
                          }}
                        >
                          <StepIcon className="w-3 h-3" />
                        </div>
                      </div>
                      <span className="text-[10px] leading-tight" style={{ color: (done || isActiveCurrent) ? stepColor : "hsl(var(--muted-foreground)/0.5)" }}>
                        {label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className="flex-1 h-px mx-1 mb-3 transition-colors"
                        style={{ background: done && i < statusIdx ? (STATUS_META[steps[i + 1]] ? STATUS_META[steps[i + 1]].color + "66" : stepColor + "66") : "hsl(var(--border))" }}
                      />
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>

          <AnimatePresence mode="wait">
            {confirmDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {activeBalanceBlocked ? (
                  <>
                    <p className="text-xs text-muted-foreground leading-snug">
                      This gift has an active balance and can't be removed until it's redeemed.{" "}
                      Need help?{" "}
                      <a
                        href="mailto:help@gifted.page"
                        className="underline text-primary hover:opacity-70 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Contact us
                      </a>
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); setActiveBalanceBlocked(false); }}
                      className="self-start px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Close
                    </button>
                  </>
                ) : hideError ? (
                  <>
                    <p className="text-xs text-destructive leading-snug">{hideError}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); setHideError(null); }}
                      className="self-start px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">Remove from your dashboard? Gift data is kept.</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); setHideError(null); }}
                        className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                        disabled={isDeleting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleHide}
                        disabled={isDeleting}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {status === "opened" && !gift.redeemedAt && (
                    <ResendButton url={shareUrl} recipientName={gift.recipientName} />
                  )}
                  {status !== "opened" && (
                    <span className="text-xs text-muted-foreground">
                      {status === "redeemed" && gift.redeemedAt
                        ? `Redeemed ${formatDistanceToNow(new Date(gift.redeemedAt), { addSuffix: true })}`
                        : status === "sent"
                          ? `Ready since ${format(new Date(gift.createdAt), "MMM d, yyyy")}`
                        : status === "ready"
                          ? `Created ${format(new Date(gift.createdAt), "MMM d, yyyy")}`
                        : status === "scheduled" && gift.scheduledFor
                          ? `Scheduled for ${format(new Date(gift.scheduledFor), "MMM d, yyyy")}`
                          : `Draft · ${format(new Date(gift.createdAt), "MMM d, yyyy")}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {status !== "ready" && status !== "sent" && (
                    <CopyButton url={shareUrl} />
                  )}
                  <a
                    href={`${shareUrl}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Preview gift"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    title="Remove from dashboard"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Received gift card ───────────────────────────────────────────────────────

function ReceivedGiftCard({ gift, idx }: { gift: ReceivedGiftSummary; idx: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const exp = EXPERIENCE_META[gift.experience] ?? DEFAULT_EXP;
  const ExpIcon = exp.Icon;

  function handleCardClick() {
    if (confirmDelete) return;
    setLocation(`/open/${gift.id}`);
  }

  const handleHideReceived = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/gifts/${gift.id}/hide-received`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to hide");
      await queryClient.invalidateQueries({ queryKey: ["received-gifts"] });
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }, [gift.id, queryClient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + idx * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleCardClick}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0" style={{ background: exp.color }} />

        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: exp.bg }}>
                <ExpIcon className="w-4 h-4" style={{ color: exp.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base leading-tight truncate">{gift.giftTitle || "A gift for you"}</p>
                <p className="text-sm text-muted-foreground">
                  From <span className="font-medium text-foreground">{gift.senderName}</span>
                  {" · "}{gift.occasion}
                </p>
              </div>
            </div>

            {gift.amount && parseFloat(gift.amount) > 0 && (
              <div className="shrink-0 bg-primary/10 text-primary font-semibold text-sm px-3 py-1 rounded-full border border-primary/20">
                ${parseFloat(gift.amount).toFixed(0)}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {confirmDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-xs text-muted-foreground">Remove from received gifts?</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleHideReceived}
                    disabled={isDeleting}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "Removing…" : "Remove"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {gift.redeemedAt ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#dcfce7", color: "#15803d" }}>
                      <CheckCircle2 className="w-3 h-3" />
                      Redeemed
                    </span>
                  ) : gift.openedAt && gift.amount && parseFloat(gift.amount) > 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLocation(`/open/${gift.id}`); }}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-colors"
                      style={{ background: "hsl(28,62%,36%,0.08)", color: "hsl(28,62%,36%)", borderColor: "hsl(28,62%,36%,0.25)" }}
                    >
                      <DollarSign className="w-3 h-3" />
                      Claim ${parseFloat(gift.amount).toFixed(0)}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#dcfce7", color: "#15803d" }}>
                      <Eye className="w-3 h-3" />
                      {exp.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {gift.redeemedAt
                      ? `Redeemed ${formatDistanceToNow(new Date(gift.redeemedAt), { addSuffix: true })}`
                      : gift.openedAt
                        ? `Opened ${formatDistanceToNow(new Date(gift.openedAt), { addSuffix: true })}`
                        : gift.createdAt
                          ? `Received ${format(new Date(gift.createdAt), "MMM d, yyyy")}`
                          : ""}
                  </span>
                  <button
                    title="Remove from received gifts"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Profile Edit Modal ───────────────────────────────────────────────────────

function ProfileEditModal({ user, onClose, onSaved }: {
  user: { firstName?: string | null; lastName?: string | null };
  onClose: () => void;
  onSaved: (firstName: string, lastName: string) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { setError("First name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved(firstName.trim(), lastName.trim());
      onClose();
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-card border border-border rounded-3xl p-7 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl font-medium">Edit your name</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">First name</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="rounded-xl h-11"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Last name</label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name (optional)"
              className="rounded-xl h-11"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 mt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-full">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-full">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Contact Form ─────────────────────────────────────────────────────────

const contactsApiSupported = typeof navigator !== "undefined" && "contacts" in navigator;

function AddContactForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleImportFromContacts() {
    setImporting(true);
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        if (c.name?.[0])  setName(c.name[0]);
        if (c.tel?.[0])   setPhone(c.tel[0].replace(/\D/g, "").replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") || c.tel[0]);
        if (c.email?.[0]) setEmail(c.email[0]);
      }
    } catch {
      // User cancelled — no action needed
    } finally {
      setImporting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone, email }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
    } catch {
      setError("Couldn't save — please try again.");
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-card border border-primary/20 rounded-2xl p-5"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base">New contact</h3>
          {contactsApiSupported && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImportFromContacts}
              disabled={importing}
              className="rounded-full h-8 text-xs gap-1.5 border-primary/30 text-primary"
            >
              <BookUser className="w-3.5 h-3.5" />
              {importing ? "Opening…" : "From contacts"}
            </Button>
          )}
        </div>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name*" className="rounded-xl h-10" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-xl h-10" />
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" className="rounded-xl h-10" type="email" />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="rounded-full">Cancel</Button>
          <Button type="submit" size="sm" disabled={saving} className="rounded-full">
            {saving ? "Saving…" : "Add contact"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Add Occasion Form ────────────────────────────────────────────────────────

const OCCASION_LABELS = ["Birthday", "Anniversary", "Christmas", "Mother's Day", "Father's Day", "Valentine's Day", "Hanukkah", "Other"];

function AddOccasionForm({ contactId, onSaved, onCancel }: { contactId: string; onSaved: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState("Birthday");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/contacts/${contactId}/occasions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, month, day }),
      });
      if (!res.ok) throw new Error("Failed");
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border">
      <select
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
      >
        {OCCASION_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select
        value={month}
        onChange={e => setMonth(Number(e.target.value))}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
      >
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={day}
        onChange={e => setDay(Number(e.target.value))}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      <Button type="submit" size="sm" disabled={saving} className="rounded-full h-7 text-xs px-3">
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onRefresh, idx }: { contact: Contact; onRefresh: () => void; idx: number }) {
  const [, setLocation] = useLocation();
  const [showOccasionForm, setShowOccasionForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDeleteContact(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`${BASE}/api/gifted/contacts/${contact.id}`, { method: "DELETE", credentials: "include" });
    onRefresh();
  }

  async function handleDeleteOccasion(occasionId: string) {
    await fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions/${occasionId}`, { method: "DELETE", credentials: "include" });
    onRefresh();
  }

  function handleGiftContact() {
    clearGiftSession();
    localStorage.setItem("gifted_recipient_name", contact.name);
    if (contact.phone) localStorage.setItem("gifted_recipient_phone", contact.phone);
    setLocation("/create");
  }

  const nextOccasion = contact.occasions.length > 0
    ? [...contact.occasions].sort((a, b) => daysUntilOccasion(a.month, a.day) - daysUntilOccasion(b.month, b.day))[0]
    : null;
  const daysUntil = nextOccasion ? daysUntilOccasion(nextOccasion.month, nextOccasion.day) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + idx * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card border border-border rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-semibold text-sm">{contact.name[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-base leading-tight">{contact.name}</p>
            {(contact.phone || contact.email) && (
              <p className="text-xs text-muted-foreground truncate">{contact.phone || contact.email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleGiftContact}
            className="text-xs px-3 py-1.5 rounded-full font-medium border transition-colors hover:bg-primary/10"
            style={{ color: "hsl(28,62%,36%)", borderColor: "hsl(28,62%,36%,0.3)", background: "hsl(28,62%,36%,0.06)" }}
          >
            Gift them
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground px-2">Cancel</button>
              <button onClick={handleDeleteContact} className="text-xs text-destructive hover:text-destructive/80 px-2">Delete</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {nextOccasion && daysUntil !== null && daysUntil <= 30 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
          <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-medium">{nextOccasion.label}</span>
            {" "}
            {daysUntil === 0 ? "is today" : daysUntil === 1 ? "is tomorrow" : `in ${daysUntil} days`}
            {" · "}{MONTH_NAMES[nextOccasion.month - 1]} {nextOccasion.day}
          </p>
        </div>
      )}

      {contact.occasions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {contact.occasions.map(occ => {
            const d = daysUntilOccasion(occ.month, occ.day);
            return (
              <div key={occ.id} className="flex items-center gap-1.5 text-xs bg-secondary rounded-lg px-2.5 py-1.5">
                <Cake className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{occ.label}</span>
                <span className="text-muted-foreground">{MONTH_NAMES[occ.month - 1]} {occ.day}</span>
                {d <= 7 && (
                  <span className="text-amber-600 font-medium">· {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d}d`}</span>
                )}
                <button
                  onClick={() => handleDeleteOccasion(occ.id)}
                  className="ml-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showOccasionForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <AddOccasionForm
              contactId={contact.id}
              onSaved={() => { setShowOccasionForm(false); onRefresh(); }}
              onCancel={() => setShowOccasionForm(false)}
            />
          </motion.div>
        ) : (
          <button
            onClick={() => setShowOccasionForm(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add occasion
          </button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Upcoming Occasions Banner ────────────────────────────────────────────────

function UpcomingOccasionsBanner({ contacts, onGift }: { contacts: Contact[]; onGift: (name: string) => void }) {
  const upcoming = contacts
    .flatMap(c => c.occasions.map(o => ({ ...o, contactName: c.name, phone: c.phone })))
    .filter(o => {
      const d = daysUntilOccasion(o.month, o.day);
      return d <= 14;
    })
    .sort((a, b) => daysUntilOccasion(a.month, a.day) - daysUntilOccasion(b.month, b.day))
    .slice(0, 2);

  if (upcoming.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Bell className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 mb-1.5">Upcoming occasions</p>
          <div className="flex flex-col gap-1.5">
            {upcoming.map(o => {
              const d = daysUntilOccasion(o.month, o.day);
              return (
                <div key={o.id} className="flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-800">
                    <span className="font-medium">{o.contactName}</span>'s {o.label}
                    {" · "}
                    {d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}
                  </p>
                  <button
                    onClick={() => onGift(o.contactName)}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0 transition-colors"
                  >
                    Gift them
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "sent" | "received" | "people";

export default function MyGiftsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("sent");
  const queryClient = useQueryClient();
  const [senderBlockedNotice, setSenderBlockedNotice] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [localName, setLocalName] = useState<{ first: string; last: string } | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    const authReturn = localStorage.getItem("gifted_auth_return");
    if (!authReturn) return;
    localStorage.removeItem("gifted_auth_return");

    const [returnPath, qs] = authReturn.split("?", 2);
    const params = new URLSearchParams(qs ?? "");
    const claimId = params.get("claim");
    const saveReceivedId = params.get("save-received");

    if (claimId) {
      fetch(`${BASE}/api/gifted/gifts/${claimId}/claim`, {
        method: "PATCH",
        credentials: "include",
      }).finally(() => {
        if (returnPath !== "/my-gifts") setLocation(returnPath);
      });
    } else if (saveReceivedId) {
      fetch(`${BASE}/api/gifted/gifts/${saveReceivedId}/save-received`, {
        method: "PATCH",
        credentials: "include",
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        const blockedAsSender = body?.isSender === true;
        if (!blockedAsSender && res.ok) {
          queryClient.invalidateQueries({ queryKey: ["received-gifts"] });
          setActiveTab("received");
        } else if (blockedAsSender) {
          setSenderBlockedNotice(true);
          setActiveTab("sent");
        }
      }).catch(() => {});
    } else if (returnPath !== "/my-gifts") {
      setLocation(returnPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewGift() {
    clearGiftSession();
    setLocation("/create");
  }

  function handleGiftContact(contactName: string) {
    clearGiftSession();
    localStorage.setItem("gifted_recipient_name", contactName);
    setLocation("/create");
  }

  const { data: myGifts, isLoading: giftsLoading } = useQuery({
    queryKey: ["my-gifts"],
    queryFn: fetchMyGifts,
    enabled: isAuthenticated,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: receivedGifts, isLoading: receivedLoading } = useQuery({
    queryKey: ["received-gifts"],
    queryFn: fetchReceivedGifts,
    enabled: isAuthenticated,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: contactsData, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: fetchContacts,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-24 text-center gap-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <Gift className="w-10 h-10 text-primary" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <h1 className="font-serif text-4xl font-medium mb-3">Your gift dashboard</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Sign in to see all the gifts you've sent and received, track when they've been opened, and manage your gifting history.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button size="lg" className="rounded-full px-10 h-13" onClick={() => setLocation("/sign-in")}>
            Sign in
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-10 h-13" onClick={handleNewGift}>
            Build a moment
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Stats
  const totalSent     = myGifts?.length ?? 0;
  const totalValue    = myGifts?.filter(g => g.paid).reduce((sum, g) => sum + (parseFloat(g.amount ?? "0") || 0), 0) ?? 0;
  const openedCount   = myGifts?.filter(g => !!g.openedAt && !g.redeemedAt).length ?? 0;
  const redeemed      = myGifts?.filter(g => !!g.redeemedAt && hasBalance(g)).length ?? 0;
  const totalReceived = receivedGifts?.length ?? 0;

  // Most gifted recipient
  const recipientCounts: Record<string, number> = {};
  myGifts?.forEach(g => { recipientCounts[g.recipientName] = (recipientCounts[g.recipientName] ?? 0) + 1; });
  const mostGifted = Object.entries(recipientCounts).sort((a, b) => b[1] - a[1])[0];

  const displayFirstName = localName?.first ?? user?.firstName ?? null;
  const displayLastName  = localName?.last ?? user?.lastName ?? null;

  const initials = [displayFirstName, displayLastName]
    .filter(Boolean)
    .map(n => n![0])
    .join("")
    .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "?");

  const upcomingContactsData = contactsData ?? [];

  return (
    <div className="min-h-screen w-full pb-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 md:pt-16">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <span className="text-primary font-bold text-base">{initials}</span>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground font-medium">{greeting(displayFirstName)}</p>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl md:text-3xl font-medium leading-tight">Your gifts</h1>
                <button
                  onClick={() => setShowProfileEdit(true)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  title="Edit name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <Button onClick={handleNewGift} className="rounded-full px-5 gap-2 hidden sm:flex shadow-md hover:-translate-y-0.5 transition-transform">
            <Plus className="w-4 h-4" />
            New gift
          </Button>
        </motion.div>

        {/* ── Sender-blocked notice ── */}
        <AnimatePresence>
          {senderBlockedNotice && (
            <motion.div
              key="sender-blocked"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
            >
              <Send className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 flex-1">
                You can't save your own gift as received. It's already in your Sent tab.
              </p>
              <button onClick={() => setSenderBlockedNotice(false)} className="text-amber-500 hover:text-amber-700 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Upcoming occasions banner (sent tab only) ── */}
        {activeTab === "sent" && upcomingContactsData.length > 0 && (
          <UpcomingOccasionsBanner contacts={upcomingContactsData} onGift={handleGiftContact} />
        )}

        {/* ── Stats row (only on Sent tab) ── */}
        {activeTab === "sent" && !giftsLoading && totalSent > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Sent" value={totalSent} Icon={Package} delay={0.05} />
            <StatCard
              label="Total gifted"
              value={totalValue > 0 ? `$${totalValue.toFixed(0)}` : "—"}
              sub={mostGifted && mostGifted[1] > 1 ? `${mostGifted[0]} most gifted` : undefined}
              Icon={DollarSign}
              delay={0.1}
            />
            <StatCard label="Opened" value={openedCount} sub={openedCount === 1 ? "awaiting redemption" : openedCount > 0 ? "awaiting redemption" : undefined} Icon={Eye} delay={0.15} />
            <StatCard label="Redeemed" value={redeemed} Icon={CheckCircle2} delay={0.2} />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-6 bg-secondary/50 rounded-2xl p-1 w-fit">
          {(["sent", "received", "people"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "sent" ? "Sent" : tab === "received" ? "Received" : "People"}
              {tab === "received" && totalReceived > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  {totalReceived}
                </span>
              )}
              {tab === "people" && (contactsData?.length ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  {contactsData!.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sent tab ── */}
        {activeTab === "sent" && (
          giftsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : !myGifts || myGifts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center py-20 bg-card border border-border rounded-3xl px-6"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Gift className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-medium mb-2">No gifts sent yet</h2>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto text-sm">
                Create your first gift — a personal video, photos, note, playlist, and optional cash balance — all in one beautiful reveal.
              </p>
              <Button onClick={handleNewGift} className="rounded-full px-8 h-12 gap-2 shadow-md">
                <Plus className="w-4 h-4" />
                Send your first gift
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-between mb-1"
              >
                <p className="text-sm text-muted-foreground font-medium">
                  {totalSent} gift{totalSent !== 1 ? "s" : ""} sent
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Most recent first
                </div>
              </motion.div>
              {myGifts.map((gift, i) => (
                <GiftCard key={gift.id} gift={gift} idx={i} />
              ))}
            </div>
          )
        )}

        {/* ── Received tab ── */}
        {activeTab === "received" && (
          receivedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : !receivedGifts || receivedGifts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center py-20 bg-card border border-border rounded-3xl px-6"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Inbox className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-medium mb-2">No received gifts yet</h2>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto text-sm">
                When someone sends you a gift and you save it to your account, it will appear here.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-between mb-1"
              >
                <p className="text-sm text-muted-foreground font-medium">
                  {totalReceived} gift{totalReceived !== 1 ? "s" : ""} received
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Most recent first
                </div>
              </motion.div>
              {receivedGifts.map((gift, i) => (
                <ReceivedGiftCard key={gift.id} gift={gift} idx={i} />
              ))}
            </div>
          )
        )}

        {/* ── People tab ── */}
        {activeTab === "people" && (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-muted-foreground">Save contacts and occasion dates.</p>
                <p className="text-xs text-muted-foreground/70">We'll remind you 7 days before each occasion.</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddContact(true)}
                className="rounded-full gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </Button>
            </motion.div>

            <AnimatePresence>
              {showAddContact && (
                <AddContactForm
                  onSaved={() => { setShowAddContact(false); refetchContacts(); }}
                  onCancel={() => setShowAddContact(false)}
                />
              )}
            </AnimatePresence>

            {contactsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : !contactsData || contactsData.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 bg-card border border-border rounded-3xl px-6"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h2 className="font-serif text-xl font-medium mb-2">No people saved yet</h2>
                <p className="text-muted-foreground mb-6 max-w-xs mx-auto text-sm">
                  Add the people you gift regularly and save their birthdays and anniversaries. We'll remind you when something special is coming up.
                </p>
                <Button onClick={() => setShowAddContact(true)} className="rounded-full px-6 h-11 gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add your first contact
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {contactsData.map((c, i) => (
                  <ContactCard key={c.id} contact={c} idx={i} onRefresh={() => refetchContacts()} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <motion.button
        onClick={handleNewGift}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* ── Profile edit modal ── */}
      <AnimatePresence>
        {showProfileEdit && (
          <ProfileEditModal
            user={{ firstName: displayFirstName, lastName: displayLastName }}
            onClose={() => setShowProfileEdit(false)}
            onSaved={(first, last) => setLocalName({ first, last })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

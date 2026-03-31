import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
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
  UserPlus, Cake, Pencil, BookUser, Truck, RefreshCw, ChevronRight, Wallet,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInCalendarDays } from "date-fns";
import {
  FLOATING_OCCASION_KEYS,
  computeFloatingDate,
  resolveOccasionDate,
  daysUntilOccasion,
  buildOccasionPayload,
} from "@/lib/occasions";
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
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingStatus: TrackingEvent[] | null;
  trackingDeliveredAt: string | null;
}

interface TrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: string;
}

interface PhysicalGift {
  id: string;
  userId: string;
  label: string;
  recipientName: string | null;
  senderName: string | null;
  direction: string;
  carrier: string | null;
  trackingNumber: string | null;
  aftershipTrackingId: string | null;
  trackingStatus: TrackingEvent[] | null;
  deliveredAt: string | null;
  giftId: string | null;
  hidden: boolean | null;
  createdAt: string;
}

interface ContactOccasion {
  id: string;
  contactId: string;
  userId: string;
  label: string;
  month: number | null;
  day: number | null;
  floatingKey: string | null;
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

async function fetchPhysicalGifts(): Promise<PhysicalGift[]> {
  const res = await fetch(`${BASE}/api/gifted/physical-gifts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load physical gifts");
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
const CARRIER_LABELS: Record<string, string> = {
  usps: "USPS", ups: "UPS", fedex: "FedEx", dhl: "DHL",
  amazon: "Amazon", lasership: "LaserShip", ontrac: "OnTrac", "canada-post": "Canada Post",
};

function greeting(firstName: string | null) {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${time}, ${firstName}` : time;
}

// ─── Resend Button ────────────────────────────────────────────────────────────

function ResendButton({ url, recipientName, full = false }: { url: string; recipientName: string; full?: boolean }) {
  const [state, setState] = useState<"idle" | "shared" | "copied">("idle");
  const canMobileShare = typeof navigator?.share === "function" && window.innerWidth < 768;

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canMobileShare) {
      try {
        await navigator.share({ title: `A gift for ${recipientName}`, url });
        setState("shared");
        setTimeout(() => setState("idle"), 2500);
      } catch { /* User cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  if (full) {
    return (
      <button
        onClick={handle}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/8 border border-primary/20 text-primary font-medium text-sm hover:bg-primary/15 transition-all"
      >
        <AnimatePresence mode="wait">
          {state === "copied" ? (
            <motion.span key="copied" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Check className="w-4 h-4 text-green-600" /><span className="text-green-700">Copied!</span>
            </motion.span>
          ) : state === "shared" ? (
            <motion.span key="shared" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Check className="w-4 h-4" />Shared
            </motion.span>
          ) : (
            <motion.span key="idle" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Send className="w-4 h-4" />Resend link
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all hover:opacity-80"
      style={{ background: "hsl(28,62%,36%,0.07)", color: "hsl(28,62%,36%)", borderColor: "hsl(28,62%,36%,0.2)" }}
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

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
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
  const [activeBalanceBlocked, setActiveBalanceBlocked] = useState(false);
  const [, setHideError] = useState<string | null>(null);
  const exp = EXPERIENCE_META[gift.experience] ?? DEFAULT_EXP;
  const status = getStatus(gift);
  const statusMeta = STATUS_META[status];
  const shareUrl = `${window.location.origin}/api/share/${gift.id}`;

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

  // Simple text timeline
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
  const stepLabels: Record<TimelineStep, string> = {
    scheduled: "Scheduled", sent: "Sent", opened: "Opened", redeemed: "Redeemed",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + idx * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleCardClick}
      className="border-b border-border/40 last:border-0 px-5 py-4 hover:bg-secondary/20 transition-colors cursor-pointer"
    >
      {/* Title + amount */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="font-medium text-sm leading-snug">{gift.giftTitle || `Gift for ${gift.recipientName}`}</p>
        {giftHasBalance && (
          <p className="text-sm font-semibold text-foreground shrink-0">${parseFloat(gift.amount!).toFixed(0)}</p>
        )}
      </div>

      {/* Meta: recipient · occasion · status dot */}
      <p className="text-xs text-muted-foreground mb-2.5">
        For <span className="text-foreground font-medium">{gift.recipientName}</span>
        {" · "}{gift.occasion}
        {" · "}<span style={{ color: statusMeta.color }}>●</span>
        {" "}<span className="font-medium" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
      </p>

      {/* Reaction */}
      {gift.reaction && (
        <p className="text-xs text-muted-foreground mb-2.5">
          {gift.reaction} {gift.recipientName} reacted{gift.reactionAt ? ` ${formatDistanceToNow(new Date(gift.reactionAt), { addSuffix: true })}` : ""}
        </p>
      )}

      {/* Resend full-width button (ready / sent states) */}
      {!confirmDelete && (status === "ready" || status === "sent") && (
        <div onClick={(e) => e.stopPropagation()} className="mb-3">
          <ResendButton url={shareUrl} recipientName={gift.recipientName} full />
        </div>
      )}

      {/* Simple text timeline */}
      <div className="flex items-center gap-1.5 text-[10px] mb-3">
        {steps.map((step, i) => {
          const isActiveCurrent = (status === "ready" || status === "sent") && i === 0;
          const done = i <= statusIdx && status !== "draft" && status !== "ready" && !(status === "sent" && i === 0);
          return (
            <React.Fragment key={step}>
              {i > 0 && <span className="text-border/60">·</span>}
              <span
                className="font-medium"
                style={{
                  color: (done || isActiveCurrent)
                    ? STATUS_META[step]?.color ?? "hsl(var(--foreground))"
                    : "hsl(var(--muted-foreground)/0.4)",
                }}
              >
                {stepLabels[step]}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Actions row */}
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
                  <a href="mailto:help@gifted.page" className="underline text-primary hover:opacity-70 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Remove from your dashboard? Gift data is kept.</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
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
            <div className="flex items-center gap-0.5 shrink-0">
              {status !== "ready" && status !== "sent" && (
                <CopyButton url={shareUrl} />
              )}
              <a
                href={`${window.location.origin}${BASE}/open/${gift.id}?preview=true`}
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
    </motion.div>
  );
}

// ─── Received gift card ───────────────────────────────────────────────────────

function ReceivedGiftCard({ gift, idx }: { gift: ReceivedGiftSummary; idx: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const hasUnclaimedBalance = !!(gift.amount && parseFloat(gift.amount) > 0 && gift.openedAt && !gift.redeemedAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + idx * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleCardClick}
      className="border-b border-border/40 last:border-0 px-5 py-4 hover:bg-secondary/20 transition-colors cursor-pointer"
    >
      {/* Title + amount */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="font-medium text-sm leading-snug">{gift.giftTitle || "A gift for you"}</p>
        {gift.amount && parseFloat(gift.amount) > 0 && (
          <p className={`text-sm font-semibold shrink-0 ${hasUnclaimedBalance ? "text-primary" : "text-foreground"}`}>
            ${parseFloat(gift.amount).toFixed(0)}
          </p>
        )}
      </div>

      {/* Meta */}
      <p className="text-xs text-muted-foreground mb-2.5">
        From <span className="text-foreground font-medium">{gift.senderName}</span>
        {" · "}{gift.occasion}
        {" · "}
        {gift.redeemedAt
          ? <span className="font-medium" style={{ color: "#15803d" }}>● Redeemed</span>
          : gift.openedAt
            ? <span className="font-medium" style={{ color: "#6d28d9" }}>● Opened</span>
            : <span className="text-muted-foreground/60">● Unopened</span>
        }
      </p>

      {/* Actions row */}
      <AnimatePresence mode="wait">
        {confirmDelete ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-between gap-2"
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-muted-foreground">
              {gift.redeemedAt
                ? `Redeemed ${formatDistanceToNow(new Date(gift.redeemedAt), { addSuffix: true })}`
                : gift.openedAt
                  ? `Opened ${formatDistanceToNow(new Date(gift.openedAt), { addSuffix: true })}`
                  : `Received ${format(new Date(gift.createdAt), "MMM d, yyyy")}`}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <a
                href={`${window.location.origin}${BASE}/open/${gift.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open gift"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
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
    </motion.div>
  );
}

// ─── Physical gift card ───────────────────────────────────────────────────────

function PhysicalGiftCard({ gift, idx, onRefresh, onHide }: {
  gift: PhysicalGift;
  idx: number;
  onRefresh: () => void;
  onHide: () => void;
}) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const [hiding, setHiding] = useState(false);

  const latestEvent = gift.trackingStatus && gift.trackingStatus.length > 0
    ? gift.trackingStatus[gift.trackingStatus.length - 1]
    : null;

  const isDelivered = !!gift.deliveredAt;

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await fetch(`${BASE}/api/gifted/physical-gifts/${gift.id}/refresh`, {
        method: "PATCH",
        credentials: "include",
      });
      await queryClient.invalidateQueries({ queryKey: ["physical-gifts"] });
      onRefresh();
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }

  async function handleHide(e: React.MouseEvent) {
    e.stopPropagation();
    setHiding(true);
    try {
      await fetch(`${BASE}/api/gifted/physical-gifts/${gift.id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      await queryClient.invalidateQueries({ queryKey: ["physical-gifts"] });
      onHide();
    } catch {
      setHiding(false);
      setConfirmHide(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + idx * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-border/40 last:border-0 px-5 py-4"
    >
      {/* Label + direction */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Package className={`w-3.5 h-3.5 shrink-0 ${isDelivered ? "text-green-600" : "text-muted-foreground"}`} />
          <p className="font-medium text-sm leading-snug truncate">{gift.label}</p>
        </div>
        {isDelivered && (
          <span className="text-xs font-medium text-green-700 shrink-0">Delivered</span>
        )}
      </div>

      {/* Carrier + person meta */}
      <p className="text-xs text-muted-foreground mb-1.5 ml-5.5 pl-0.5">
        {gift.direction === "received" ? "From" : "To"}{" "}
        <span className="text-foreground font-medium">
          {gift.direction === "received" ? (gift.senderName || "—") : (gift.recipientName || "—")}
        </span>
        {gift.carrier && (
          <> · {CARRIER_LABELS[gift.carrier] ?? gift.carrier}</>
        )}
        {gift.trackingNumber && (
          <> · <span className="font-mono text-[10px]">{gift.trackingNumber.slice(0, 16)}{gift.trackingNumber.length > 16 ? "…" : ""}</span></>
        )}
      </p>

      {/* Latest tracking event */}
      {latestEvent && (
        <p className="text-xs text-muted-foreground ml-5.5 mb-1.5">
          <span className="font-medium text-foreground">{latestEvent.message}</span>
          {latestEvent.location && <> · {latestEvent.location}</>}
          {" · "}{formatDistanceToNow(new Date(latestEvent.timestamp), { addSuffix: true })}
        </p>
      )}
      {!latestEvent && gift.carrier && !isDelivered && (
        <p className="text-xs text-muted-foreground/60 ml-5.5 mb-1.5">No tracking updates yet</p>
      )}
      {!gift.carrier && (
        <p className="text-xs text-muted-foreground/60 ml-5.5 mb-1.5">No tracking added</p>
      )}

      {/* Actions */}
      {confirmHide ? (
        <div className="flex items-center gap-2 ml-5.5 mt-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">Remove this package?</span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmHide(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            disabled={hiding}
          >
            Cancel
          </button>
          <button
            onClick={handleHide}
            disabled={hiding}
            className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
          >
            {hiding ? "Removing…" : "Remove"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 ml-4 mt-1.5">
          {gift.carrier && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
              title="Refresh tracking"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmHide(true); }}
            className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Remove package"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Add Physical Gift Form ───────────────────────────────────────────────────

const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "amazon", label: "Amazon" },
  { value: "lasership", label: "LaserShip" },
  { value: "ontrac", label: "OnTrac" },
  { value: "canada-post", label: "Canada Post" },
];

function AddPhysicalGiftForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<"sent" | "received">("received");
  const [personName, setPersonName] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError("Description is required"); return; }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = {
        label: label.trim(),
        direction,
        ...(carrier ? { carrier } : {}),
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
      };
      if (direction === "received" && personName.trim()) body.senderName = personName.trim();
      if (direction === "sent" && personName.trim()) body.recipientName = personName.trim();

      const res = await fetch(`${BASE}/api/gifted/physical-gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || "Failed to save");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — please try again.");
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-secondary/30 rounded-2xl p-4 border border-border/50"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Add a package</h3>
          <div className="flex bg-secondary rounded-full p-0.5 gap-0.5">
            {(["received", "sent"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`text-xs px-3 py-1 rounded-full transition-colors font-medium ${
                  direction === d ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {d === "received" ? "I received it" : "I sent it"}
              </button>
            ))}
          </div>
        </div>

        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What is it? e.g. Birthday flowers from Dad"
          className="rounded-xl h-10 text-sm"
          autoFocus
        />
        <Input
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder={direction === "received" ? "From (optional)" : "To (optional)"}
          className="rounded-xl h-10 text-sm"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="text-sm border border-border rounded-xl px-3 py-2 bg-background text-foreground h-10"
          >
            <option value="">Carrier (optional)</option>
            {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Tracking # (optional)"
            className="rounded-xl h-10 text-sm font-mono"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="rounded-full">Cancel</Button>
          <Button type="submit" size="sm" disabled={saving} className="rounded-full">
            {saving ? "Saving…" : "Add package"}
          </Button>
        </div>
      </form>
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
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-xl h-11" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Last name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name (optional)" className="rounded-xl h-11" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 mt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-full">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-full">{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Add Contact Form ─────────────────────────────────────────────────────────

const contactsApiSupported = typeof navigator !== "undefined" && "contacts" in navigator;

type PendingOccasion = { label: string; month: number; day: number };

const OCCASION_LABELS = ["Birthday", "Anniversary", "Christmas", "Mother's Day", "Father's Day", "Thanksgiving", "Valentine's Day", "Hanukkah", "Other"];

function OccasionDateFields({ label, month, day, onMonthChange, onDayChange }: {
  label: string; month: number; day: number;
  onMonthChange: (m: number) => void; onDayChange: (d: number) => void;
}) {
  const isFloating = label in FLOATING_OCCASION_KEYS;
  if (isFloating) {
    const floatingKey = FLOATING_OCCASION_KEYS[label];
    const { month: fm, day: fd } = computeFloatingDate(floatingKey, new Date().getFullYear());
    return (
      <span className="text-xs text-muted-foreground italic">
        Date computed each year · {MONTH_NAMES[fm - 1]} {fd} this year
      </span>
    );
  }
  return (
    <>
      <select
        value={month}
        onChange={e => onMonthChange(Number(e.target.value))}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
      >
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={day}
        onChange={e => onDayChange(Number(e.target.value))}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </>
  );
}

function AddContactForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [pendingOccasions, setPendingOccasions] = useState<PendingOccasion[]>([]);

  function addOccasionRow() { setPendingOccasions(r => [...r, { label: "Birthday", month: 1, day: 1 }]); }
  function updateOccasionRow(i: number, patch: Partial<PendingOccasion>) {
    setPendingOccasions(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }
  function removeOccasionRow(i: number) { setPendingOccasions(r => r.filter((_, idx) => idx !== i)); }

  async function handleImportFromContacts() {
    setImporting(true);
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false });
      if (contacts && contacts.length > 0) {
        const c = contacts[0];
        if (c.name?.[0]) setName(c.name[0]);
        if (c.tel?.[0]) setPhone(c.tel[0].replace(/\D/g, "").replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") || c.tel[0]);
        if (c.email?.[0]) setEmail(c.email[0]);
      }
    } catch { /* User cancelled */ } finally {
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
      const contact = await res.json() as { id: string };
      if (pendingOccasions.length > 0) {
        await Promise.all(pendingOccasions.map(occ =>
          fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(buildOccasionPayload(occ.label, occ.month, occ.day)),
          })
        ));
      }
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
            <Button type="button" variant="outline" size="sm" onClick={handleImportFromContacts} disabled={importing} className="rounded-full h-8 text-xs gap-1.5 border-primary/30 text-primary">
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
        {pendingOccasions.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground">Occasions</span>
            {pendingOccasions.map((occ, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={occ.label} onChange={e => updateOccasionRow(i, { label: e.target.value })} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground flex-1 min-w-[120px]">
                  {OCCASION_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <OccasionDateFields label={occ.label} month={occ.month} day={occ.day} onMonthChange={m => updateOccasionRow(i, { month: m })} onDayChange={d => updateOccasionRow(i, { day: d })} />
                <button type="button" onClick={() => removeOccasionRow(i)} className="text-muted-foreground/60 hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addOccasionRow} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors self-start">
          <Cake className="w-3.5 h-3.5" />
          {pendingOccasions.length === 0 ? "Add an occasion (optional)" : "Add another occasion"}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="rounded-full">Cancel</Button>
          <Button type="submit" size="sm" disabled={saving} className="rounded-full">{saving ? "Saving…" : "Add contact"}</Button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Add Occasion Form ────────────────────────────────────────────────────────

function AddOccasionForm({ contactId, onSaved, onCancel }: { contactId: string; onSaved: () => void; onCancel: () => void }) {
  const [rows, setRows] = useState<PendingOccasion[]>([{ label: "Birthday", month: 1, day: 1 }]);
  const [saving, setSaving] = useState(false);

  function updateRow(i: number, patch: Partial<PendingOccasion>) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(rows.map(occ =>
        fetch(`${BASE}/api/gifted/contacts/${contactId}/occasions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(buildOccasionPayload(occ.label, occ.month, occ.day)),
        })
      ));
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2 pt-2">
      {rows.map((occ, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select value={occ.label} onChange={e => updateRow(i, { label: e.target.value })} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground">
            {OCCASION_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <OccasionDateFields label={occ.label} month={occ.month} day={occ.day} onMonthChange={m => updateRow(i, { month: m })} onDayChange={d => updateRow(i, { day: d })} />
          {rows.length > 1 && (
            <button type="button" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))} className="text-muted-foreground/50 hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <Button type="submit" size="sm" disabled={saving} className="rounded-full h-7 text-xs">{saving ? "Saving…" : "Save"}</Button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button type="button" onClick={() => setRows(r => [...r, { label: "Birthday", month: 1, day: 1 }])} className="text-xs text-primary hover:opacity-80 transition-opacity ml-auto">+ Add another</button>
      </div>
    </form>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

type OccasionEditRow = { id: string | null; label: string; month: number; day: number; floatingKey: string | null; deleted: boolean };

function initOccasionRows(occasions: ContactOccasion[]): OccasionEditRow[] {
  return occasions.map(o => ({
    id: o.id,
    label: o.label,
    month: o.month ?? 1,
    day: o.day ?? 1,
    floatingKey: o.floatingKey ?? null,
    deleted: false,
  }));
}

function ContactCard({ contact, idx, onRefresh }: { contact: Contact; idx: number; onRefresh: () => void }) {
  const [, setLocation] = useLocation();
  const [showOccasionForm, setShowOccasionForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editPhone, setEditPhone] = useState(contact.phone ?? "");
  const [editEmail, setEditEmail] = useState(contact.email ?? "");
  const [editOccasions, setEditOccasions] = useState<OccasionEditRow[]>(initOccasionRows(contact.occasions));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDeleteContact() {
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

  function openEdit() {
    setEditName(contact.name);
    setEditPhone(contact.phone ?? "");
    setEditEmail(contact.email ?? "");
    setEditOccasions(initOccasionRows(contact.occasions));
    setEditError("");
    setShowEdit(true);
  }

  function updateEditOccasion(i: number, patch: Partial<OccasionEditRow>) {
    setEditOccasions(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addEditOccasionRow() {
    setEditOccasions(rows => [...rows, { id: null, label: "Birthday", month: 1, day: 1, floatingKey: null, deleted: false }]);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError("Name is required"); return; }
    setEditSaving(true);
    setEditError("");
    try {
      const contactRes = await fetch(`${BASE}/api/gifted/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName, phone: editPhone, email: editEmail, notes: contact.notes ?? undefined }),
      });
      if (!contactRes.ok) throw new Error("Failed");
      const originalById = Object.fromEntries(contact.occasions.map(o => [o.id, o]));
      await Promise.all(editOccasions.map(row => {
        const payload = buildOccasionPayload(row.label, row.month, row.day);
        if (row.id) {
          if (row.deleted) return fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions/${row.id}`, { method: "DELETE", credentials: "include" });
          const orig = originalById[row.id];
          const changed = !orig || orig.label !== row.label || orig.month !== row.month || orig.day !== row.day || orig.floatingKey !== row.floatingKey;
          if (changed) {
            return fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions/${row.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
          }
        } else if (!row.deleted) {
          return fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
        }
        return Promise.resolve();
      }));
      setShowEdit(false);
      onRefresh();
    } catch {
      setEditError("Couldn't save — please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  function handleEditCancel() { setEditError(""); setShowEdit(false); }

  const nextOccasion = contact.occasions.length > 0
    ? [...contact.occasions].sort((a, b) => daysUntilOccasion(a) - daysUntilOccasion(b))[0]
    : null;
  const daysUntil = nextOccasion ? daysUntilOccasion(nextOccasion) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + idx * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-border/40 last:border-0 py-4"
    >
      {showEdit ? (
        <form onSubmit={handleEditSave} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Edit contact</h3>
            <button type="button" onClick={handleEditCancel} className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Cancel</button>
          </div>
          <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name*" className="rounded-xl h-9 text-sm" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-xl h-9 text-sm" />
            <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email (optional)" className="rounded-xl h-9 text-sm" type="email" />
          </div>
          {editOccasions.filter(r => !r.deleted).length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground">Occasions</span>
              {editOccasions.map((row, i) => row.deleted ? null : (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select value={row.label} onChange={e => { const newLabel = e.target.value; const fk = FLOATING_OCCASION_KEYS[newLabel] ?? null; updateEditOccasion(i, { label: newLabel, floatingKey: fk }); }} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground">
                    {OCCASION_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <OccasionDateFields label={row.label} month={row.month} day={row.day} onMonthChange={m => updateEditOccasion(i, { month: m })} onDayChange={d => updateEditOccasion(i, { day: d })} />
                  <button type="button" onClick={() => { if (row.id) { updateEditOccasion(i, { deleted: true }); } else { setEditOccasions(rows => rows.filter((_, idx) => idx !== i)); } }} className="text-muted-foreground/50 hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={addEditOccasionRow} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors self-start">
            <Cake className="w-3.5 h-3.5" />
            {editOccasions.filter(r => !r.deleted).length === 0 ? "Add an occasion" : "Add another occasion"}
          </button>
          {editError && <p className="text-xs text-destructive">{editError}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={editSaving} className="rounded-full h-8 text-xs">{editSaving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <span className="text-foreground font-semibold text-sm">{contact.name[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight">{contact.name}</p>
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
              <>
                <button onClick={openEdit} className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!showEdit && nextOccasion && daysUntil !== null && daysUntil <= 30 && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
          <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-medium">{nextOccasion.label}</span>{" "}
            {daysUntil === 0 ? "is today" : daysUntil === 1 ? "is tomorrow" : `in ${daysUntil} days`}
            {" · "}{(() => { const r = resolveOccasionDate(nextOccasion); return `${MONTH_NAMES[r.month - 1]} ${r.day}`; })()}
          </p>
        </div>
      )}

      {!showEdit && contact.occasions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {contact.occasions.map(occ => {
            const d = daysUntilOccasion(occ);
            const r = resolveOccasionDate(occ);
            return (
              <div key={occ.id} className="flex items-center gap-1.5 text-xs bg-secondary rounded-lg px-2.5 py-1.5">
                <Cake className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{occ.label}</span>
                <span className="text-muted-foreground">{MONTH_NAMES[r.month - 1]} {r.day}</span>
                {d <= 7 && <span className="text-amber-600 font-medium">· {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d}d`}</span>}
                <button onClick={() => handleDeleteOccasion(occ.id)} className="ml-1 text-muted-foreground/50 hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!showEdit && (
        <AnimatePresence>
          {showOccasionForm ? (
            <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <AddOccasionForm
                contactId={contact.id}
                onSaved={() => { setShowOccasionForm(false); onRefresh(); }}
                onCancel={() => setShowOccasionForm(false)}
              />
            </motion.div>
          ) : (
            <button onClick={() => setShowOccasionForm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-2">
              <Plus className="w-3 h-3" />
              Add occasion
            </button>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

// ─── Upcoming Occasions Banner ────────────────────────────────────────────────

function UpcomingOccasionsBanner({ contacts, onGift }: { contacts: Contact[]; onGift: (name: string) => void }) {
  const upcoming = contacts
    .flatMap(c => c.occasions.map(o => ({ ...o, contactName: c.name, phone: c.phone })))
    .filter(o => daysUntilOccasion(o) <= 14)
    .sort((a, b) => daysUntilOccasion(a) - daysUntilOccasion(b))
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
              const d = daysUntilOccasion(o);
              return (
                <div key={o.id} className="flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-800">
                    <span className="font-medium">{o.contactName}</span>'s {o.label}
                    {" · "}{d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}
                  </p>
                  <button onClick={() => onGift(o.contactName)} className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0 transition-colors">
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

// ─── Linked gift tracking (from digital gift moments) ────────────────────────

function LinkedGiftTracking({ gift, idx }: { gift: ReceivedGiftSummary; idx: number }) {
  const [, setLocation] = useLocation();
  const latestEvent = gift.trackingStatus && gift.trackingStatus.length > 0
    ? gift.trackingStatus[gift.trackingStatus.length - 1]
    : null;
  const isDelivered = !!gift.trackingDeliveredAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + idx * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-border/40 last:border-0 px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Package className={`w-3.5 h-3.5 shrink-0 ${isDelivered ? "text-green-600" : "text-muted-foreground"}`} />
          <p className="font-medium text-sm leading-snug truncate">
            {gift.giftTitle || "A gift"} — shipment
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDelivered && <span className="text-xs font-medium text-green-700">Delivered</span>}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "hsl(28,62%,36%,0.08)", color: "hsl(28,62%,36%)" }}
          >
            from moment
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-1.5 ml-5.5 pl-0.5">
        From <span className="text-foreground font-medium">{gift.senderName}</span>
        {gift.trackingCarrier && (
          <> · {CARRIER_LABELS[gift.trackingCarrier] ?? gift.trackingCarrier}</>
        )}
        {gift.trackingNumber && (
          <> · <span className="font-mono text-[10px]">{gift.trackingNumber.slice(0, 16)}{gift.trackingNumber.length > 16 ? "…" : ""}</span></>
        )}
      </p>

      {latestEvent ? (
        <p className="text-xs text-muted-foreground ml-5.5 mb-1">
          <span className="font-medium text-foreground">{latestEvent.message}</span>
          {latestEvent.location && <> · {latestEvent.location}</>}
          {" · "}{formatDistanceToNow(new Date(latestEvent.timestamp), { addSuffix: true })}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60 ml-5.5 mb-1">No tracking updates yet</p>
      )}

      <div className="ml-4 mt-1">
        <button
          onClick={() => setLocation(`/open/${gift.id}`)}
          className="text-xs text-primary font-medium hover:opacity-80 transition-opacity"
        >
          View gift →
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "inbox" | "sent" | "scheduled" | "people";

const INBOX_PREVIEW_COUNT = 5;

export default function MyGiftsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [activeStatFilter, setActiveStatFilter] = useState<"opened" | "redeemed" | null>(null);
  const queryClient = useQueryClient();
  const [senderBlockedNotice, setSenderBlockedNotice] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [localName, setLocalName] = useState<{ first: string; last: string } | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddPhysical, setShowAddPhysical] = useState(false);
  const [showAllReceived, setShowAllReceived] = useState(false);
  const [copiedGiftId, setCopiedGiftId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab === "contacts" || tab === "people") setActiveTab("people");
    if (tab === "inbox" || tab === "received") setActiveTab("inbox");
    if (tab === "scheduled") setActiveTab("scheduled");
  }, [search]);

  useEffect(() => {
    const authReturn = localStorage.getItem("gifted_auth_return");
    if (!authReturn) return;
    localStorage.removeItem("gifted_auth_return");
    const [returnPath, qs] = authReturn.split("?", 2);
    const params = new URLSearchParams(qs ?? "");
    const claimId = params.get("claim");
    const saveReceivedId = params.get("save-received");
    if (claimId) {
      fetch(`${BASE}/api/gifted/gifts/${claimId}/claim`, { method: "PATCH", credentials: "include" })
        .finally(() => { if (returnPath !== "/my-gifts") setLocation(returnPath); });
    } else if (saveReceivedId) {
      fetch(`${BASE}/api/gifted/gifts/${saveReceivedId}/save-received`, { method: "PATCH", credentials: "include" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          const blockedAsSender = (body as any)?.isSender === true;
          if (!blockedAsSender && res.ok) {
            queryClient.invalidateQueries({ queryKey: ["received-gifts"] });
            setActiveTab("inbox");
          } else if (blockedAsSender) {
            setSenderBlockedNotice(true);
            setActiveTab("sent");
          }
        }).catch(() => {});
    } else if (returnPath !== "/my-gifts") {
      setLocation(returnPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewGift() { clearGiftSession(); setLocation("/create"); }
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

  const { data: physicalGiftsData, isLoading: physicalLoading, refetch: refetchPhysical } = useQuery({
    queryKey: ["physical-gifts"],
    queryFn: fetchPhysicalGifts,
    enabled: isAuthenticated,
    staleTime: 30_000,
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
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="w-10 h-10 text-primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
          <h1 className="font-serif text-4xl font-medium mb-3">Your gift dashboard</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">Sign in to see all the gifts you've sent and received, track when they've been opened, and manage your gifting history.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" className="rounded-full px-10 h-13" onClick={() => setLocation("/sign-in")}>Sign in</Button>
          <Button size="lg" variant="outline" className="rounded-full px-10 h-13" onClick={handleNewGift}>Build a moment</Button>
        </motion.div>
      </div>
    );
  }

  // Stats
  const totalSent     = myGifts?.length ?? 0;
  const totalValue    = myGifts?.filter(g => g.paid).reduce((sum, g) => sum + (parseFloat(g.amount ?? "0") || 0), 0) ?? 0;
  const openedCount   = myGifts?.filter(g => !!g.openedAt && !g.redeemedAt).length ?? 0;
  const redeemed      = myGifts?.filter(g => !!g.redeemedAt && hasBalance(g)).length ?? 0;
  const totalReceived = receivedGifts?.length ?? 0;

  const recipientCounts: Record<string, number> = {};
  myGifts?.forEach(g => { recipientCounts[g.recipientName] = (recipientCounts[g.recipientName] ?? 0) + 1; });

  const displayFirstName = localName?.first ?? user?.firstName ?? null;
  const displayLastName  = localName?.last ?? user?.lastName ?? null;
  const initials = [displayFirstName, displayLastName].filter(Boolean).map(n => n![0]).join("").toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "?");

  const upcomingContactsData = contactsData ?? [];

  // Received gifts with unclaimed balance (for the action banner)
  const unclaimedGifts = receivedGifts?.filter(g =>
    g.amount && parseFloat(g.amount) > 0 && g.openedAt && !g.redeemedAt
  ) ?? [];
  const totalUnclaimedBalance = unclaimedGifts.reduce((sum, g) => sum + parseFloat(g.amount!), 0);

  const scheduledGifts = (myGifts ?? []).filter(g => g.scheduledFor && !g.openedAt);

  const TAB_LABELS: Record<Tab, string> = { inbox: "My Gifts", sent: "Sent", scheduled: "Scheduled", people: "People" };

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
              <img src={user.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-border" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center ring-2 ring-border">
                <span className="text-foreground font-bold text-base">{initials}</span>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium">{greeting(displayFirstName)}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab(activeTab === "inbox" ? "sent" : "inbox")}
                  className="font-serif text-2xl md:text-3xl font-medium leading-tight hover:text-primary transition-colors flex items-center gap-1 group"
                  title="View my gifts"
                >
                  Your gifts
                  <ChevronRight className={`w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-all ${activeTab === "inbox" ? "rotate-90 text-primary" : ""}`} />
                </button>
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
          <Button onClick={handleNewGift} className="rounded-full px-5 gap-2 hidden sm:flex shadow-sm hover:-translate-y-0.5 transition-transform">
            <Plus className="w-4 h-4" />
            Build a moment
          </Button>
        </motion.div>

        {/* ── Sender-blocked notice ── */}
        <AnimatePresence>
          {senderBlockedNotice && (
            <motion.div key="sender-blocked" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <Send className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 flex-1">You can't save your own gift as received. It's already in your Sent tab.</p>
              <button onClick={() => setSenderBlockedNotice(false)} className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Upcoming occasions banner (sent tab only) ── */}
        {activeTab === "sent" && upcomingContactsData.length > 0 && (
          <UpcomingOccasionsBanner contacts={upcomingContactsData} onGift={handleGiftContact} />
        )}

        {/* ── Flat stat strip (Sent tab, has gifts) ── */}
        {activeTab === "sent" && !giftsLoading && totalSent > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="flex divide-x divide-border/50 border border-border/60 rounded-xl mb-7 bg-card overflow-hidden"
          >
            <div className="flex-1 px-4 py-3.5 min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Sent</p>
              <p className="font-serif text-2xl font-medium">{totalSent}</p>
            </div>
            <div className="flex-1 px-4 py-3.5 min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Total</p>
              <p className="font-serif text-2xl font-medium">{totalValue > 0 ? `$${totalValue.toFixed(0)}` : "—"}</p>
            </div>
            <button
              className={`flex-1 px-4 py-3.5 text-left transition-colors min-w-0 ${activeStatFilter === "opened" ? "bg-primary/5" : "hover:bg-secondary/50"}`}
              onClick={() => { setActiveStatFilter(f => f === "opened" ? null : "opened"); setActiveTab("sent"); }}
            >
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Opened</p>
              <p className={`font-serif text-2xl font-medium ${activeStatFilter === "opened" ? "text-primary" : ""}`}>{openedCount}</p>
            </button>
            <button
              className={`flex-1 px-4 py-3.5 text-left transition-colors min-w-0 ${activeStatFilter === "redeemed" ? "bg-primary/5" : "hover:bg-secondary/50"}`}
              onClick={() => { setActiveStatFilter(f => f === "redeemed" ? null : "redeemed"); setActiveTab("sent"); }}
            >
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Redeemed</p>
              <p className={`font-serif text-2xl font-medium ${activeStatFilter === "redeemed" ? "text-primary" : ""}`}>{redeemed}</p>
            </button>
          </motion.div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 border-b border-border/50 mb-6">
          {(["inbox", "sent", "scheduled", "people"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? "text-foreground border-b-2 border-foreground -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[tab]}
              {tab === "inbox" && totalReceived > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  {totalReceived}
                </span>
              )}
              {tab === "scheduled" && scheduledGifts.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  {scheduledGifts.length}
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
            <div className="space-y-0 border border-border/60 rounded-xl bg-card overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 border-b border-border/40 last:border-0 px-5 py-4">
                  <div className="h-3 w-48 bg-muted/50 rounded animate-pulse mb-2" />
                  <div className="h-2.5 w-32 bg-muted/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !myGifts || myGifts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center py-20 bg-card border border-border/60 rounded-2xl px-6"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Gift className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-medium mb-2">No gifts sent yet</h2>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto text-sm">
                Create your first gift — a personal video, photos, note, playlist, and optional cash balance — all in one beautiful reveal.
              </p>
              <Button onClick={handleNewGift} className="rounded-full px-8 h-12 gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Send your first gift
              </Button>
            </motion.div>
          ) : (
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between mb-3"
              >
                {activeStatFilter ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {activeStatFilter === "opened" ? "Opened — awaiting redemption" : "Redeemed"}
                    </span>
                    <button
                      onClick={() => setActiveStatFilter(null)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded-full px-2 py-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{totalSent} gift{totalSent !== 1 ? "s" : ""} sent · most recent first</p>
                )}
              </motion.div>
              {(() => {
                const filtered = activeStatFilter
                  ? myGifts.filter(g =>
                      activeStatFilter === "opened" ? !!g.openedAt && !g.redeemedAt : !!g.redeemedAt
                    )
                  : myGifts;

                if (filtered.length === 0) {
                  return (
                    <div className="border border-border/60 rounded-xl bg-card px-6 py-10 text-center">
                      <p className="text-sm font-medium text-foreground mb-1">
                        {activeStatFilter === "redeemed" ? "No moments redeemed yet" : "No gifts in this view"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeStatFilter === "redeemed"
                          ? "When a recipient redeems their gift balance, it'll appear here."
                          : "Nothing matches this filter right now."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                    {filtered.map((gift, i) => (
                      <GiftCard key={gift.id} gift={gift} idx={i} />
                    ))}
                  </div>
                );
              })()}
            </div>
          )
        )}

        {/* ── My Gifts (Inbox) tab ── */}
        {activeTab === "inbox" && (() => {
          // Received digital gifts that also have tracking (shared during moment creation)
          const receivedWithTracking = (receivedGifts ?? []).filter(
            g => g.trackingCarrier && g.trackingNumber
          );
          // All package rows: standalone physical + linked digital tracking
          const hasAnyPackages = (physicalGiftsData?.length ?? 0) > 0 || receivedWithTracking.length > 0;

          const visibleReceived = showAllReceived
            ? (receivedGifts ?? [])
            : (receivedGifts ?? []).slice(0, INBOX_PREVIEW_COUNT);
          const hiddenCount = Math.max(0, (receivedGifts?.length ?? 0) - INBOX_PREVIEW_COUNT);

          return (
            <div className="space-y-6">
              {/* ── 1. Redemption callout — always at top ── */}
              {!receivedLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-xl overflow-hidden ${unclaimedGifts.length > 0 ? "border-primary/25 bg-primary/5" : "border-border/60 bg-card"}`}
                >
                  {unclaimedGifts.length > 0 ? (
                    <>
                      <div className="px-5 py-4 border-b border-primary/15 flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          You have ${totalUnclaimedBalance.toFixed(0)} to collect
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {unclaimedGifts.length} gift{unclaimedGifts.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {unclaimedGifts.map((gift) => (
                        <div
                          key={gift.id}
                          className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-primary/10 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{gift.giftTitle || "A gift for you"}</p>
                            <p className="text-xs text-muted-foreground">From {gift.senderName}</p>
                          </div>
                          <button
                            onClick={() => setLocation(`/open/${gift.id}`)}
                            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full shadow-sm"
                          >
                            Collect ${parseFloat(gift.amount!).toFixed(0)}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="px-5 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Nothing to redeem right now</p>
                        <p className="text-xs text-muted-foreground">Any gift balances ready to collect will appear here.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── 2. Received digital gifts ── */}
              <div>
                {receivedLoading ? (
                  <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 border-b border-border/40 last:border-0 px-5 py-4">
                        <div className="h-3 w-48 bg-muted/50 rounded animate-pulse mb-2" />
                        <div className="h-2.5 w-32 bg-muted/30 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : !receivedGifts || receivedGifts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 bg-card border border-border/60 rounded-2xl px-6"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Inbox className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="font-serif text-xl font-medium mb-2">No received gifts yet</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                      When someone sends you a gift and you save it to your account, it will appear here.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {totalReceived} gift{totalReceived !== 1 ? "s" : ""} received
                    </p>
                    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                      {visibleReceived.map((gift, i) => (
                        <ReceivedGiftCard key={gift.id} gift={gift} idx={i} />
                      ))}
                    </div>
                    {hiddenCount > 0 && !showAllReceived && (
                      <button
                        onClick={() => setShowAllReceived(true)}
                        className="w-full mt-2 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-xl bg-card hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                        Show {hiddenCount} more gift{hiddenCount !== 1 ? "s" : ""}
                      </button>
                    )}
                    {showAllReceived && totalReceived > INBOX_PREVIEW_COUNT && (
                      <button
                        onClick={() => setShowAllReceived(false)}
                        className="w-full mt-2 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-xl bg-card hover:bg-secondary/30 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ChevronRight className="w-4 h-4 -rotate-90" />
                        Show less
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── 3. Physical packages ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Physical packages</p>
                    <p className="text-xs text-muted-foreground">Packages and shipments attached to your gifts</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddPhysical(v => !v)}
                    className="rounded-full gap-1.5 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </div>

                <AnimatePresence>
                  {showAddPhysical && (
                    <motion.div key="add-physical" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                      <AddPhysicalGiftForm
                        onSaved={() => { setShowAddPhysical(false); refetchPhysical(); queryClient.invalidateQueries({ queryKey: ["physical-gifts"] }); }}
                        onCancel={() => setShowAddPhysical(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {physicalLoading ? (
                  <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 border-b border-border/40 last:border-0 px-5 py-4">
                        <div className="h-3 w-36 bg-muted/50 rounded animate-pulse mb-2" />
                        <div className="h-2.5 w-52 bg-muted/30 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : !hasAnyPackages ? (
                  !showAddPhysical && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12 bg-card border border-border/60 rounded-xl px-6"
                    >
                      <Truck className="w-7 h-7 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No packages yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Packages linked during a gift moment appear here automatically
                      </p>
                      <button
                        onClick={() => setShowAddPhysical(true)}
                        className="mt-4 text-xs text-primary font-medium hover:opacity-80 transition-opacity"
                      >
                        + Add a package manually
                      </button>
                    </motion.div>
                  )
                ) : (
                  <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                    {/* Standalone physical gifts */}
                    {(physicalGiftsData ?? []).map((pg, i) => (
                      <PhysicalGiftCard
                        key={pg.id}
                        gift={pg}
                        idx={i}
                        onRefresh={() => refetchPhysical()}
                        onHide={() => { queryClient.invalidateQueries({ queryKey: ["physical-gifts"] }); refetchPhysical(); }}
                      />
                    ))}
                    {/* Tracking from received digital gifts (added during moment creation) */}
                    {receivedWithTracking.map((g, i) => (
                      <LinkedGiftTracking
                        key={`linked-${g.id}`}
                        gift={g}
                        idx={(physicalGiftsData?.length ?? 0) + i}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Scheduled tab ── */}
        {activeTab === "scheduled" && (
          giftsLoading ? (
            <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 border-b border-border/40 last:border-0 px-5 py-4">
                  <div className="h-3 w-48 bg-muted/50 rounded animate-pulse mb-2" />
                  <div className="h-2.5 w-32 bg-muted/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : scheduledGifts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center py-20 bg-card border border-border/60 rounded-2xl px-6"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <CalendarClock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-serif text-2xl font-medium mb-2">No scheduled gifts</h2>
              <p className="text-muted-foreground mb-8 max-w-xs mx-auto text-sm">
                When you build a gift and set a reminder date, it appears here so you never miss the moment.
              </p>
              <Button onClick={handleNewGift} className="rounded-full px-8 h-12 gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Build a moment
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
            >
              <p className="text-xs text-muted-foreground mb-3">
                {scheduledGifts.length} gift{scheduledGifts.length !== 1 ? "s" : ""} waiting to be shared
              </p>
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
                {scheduledGifts.map((gift, i) => {
                  const schedDate = new Date(gift.scheduledFor!);
                  const days = differenceInCalendarDays(schedDate, new Date());
                  const shareUrl = `${window.location.origin}${BASE}/api/share/${gift.id}`;
                  const isCopied = copiedGiftId === gift.id;

                  let urgencyLabel: string;
                  let urgencyClass: string;
                  if (days < 0) {
                    urgencyLabel = `${Math.abs(days)}d overdue — share now`;
                    urgencyClass = "text-red-600";
                  } else if (days === 0) {
                    urgencyLabel = "Today — ready to share";
                    urgencyClass = "text-amber-600";
                  } else if (days === 1) {
                    urgencyLabel = "Tomorrow";
                    urgencyClass = "text-primary";
                  } else {
                    urgencyLabel = `In ${days} days · ${format(schedDate, "MMM d")}`;
                    urgencyClass = "text-muted-foreground";
                  }

                  const initial = gift.recipientName?.[0]?.toUpperCase() ?? "?";

                  return (
                    <motion.div
                      key={gift.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 px-5 py-4 border-b border-border/40 last:border-0"
                    >
                      {/* Recipient initial */}
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-foreground">{initial}</span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{gift.recipientName}</p>
                          {gift.occasion && (
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                              {gift.occasion}
                            </span>
                          )}
                          {gift.scheduleDelivered && (
                            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              Reminder sent
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 font-medium ${urgencyClass}`}>
                          <CalendarClock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                          {urgencyLabel}
                        </p>
                        {gift.giftTitle && (
                          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{gift.giftTitle}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareUrl).then(() => {
                              setCopiedGiftId(gift.id);
                              setTimeout(() => setCopiedGiftId(null), 2000);
                            }).catch(() => {});
                          }}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                            isCopied
                              ? "text-green-700 bg-green-50 border border-green-200"
                              : "text-white bg-primary hover:bg-primary/90 shadow-sm"
                          }`}
                        >
                          {isCopied ? (
                            <><Check className="w-3.5 h-3.5" /> Copied</>
                          ) : (
                            <><Share2 className="w-3.5 h-3.5" /> Share</>
                          )}
                        </button>
                        <button
                          onClick={() => setLocation(`/open/${gift.id}`)}
                          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                          title="View gift"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground/60 text-center mt-4 max-w-sm mx-auto">
                Share the link directly from your phone when the moment is right — no automated delivery.
              </p>
            </motion.div>
          )
        )}

        {/* ── People tab ── */}
        {activeTab === "people" && (
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Save contacts and occasion dates.</p>
                <p className="text-xs text-muted-foreground/70">We'll remind you 7 days before each occasion and again on the day.</p>
              </div>
              <Button size="sm" onClick={() => setShowAddContact(true)} className="rounded-full gap-1.5">
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
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden px-4">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 border-b border-border/40 last:border-0 py-4">
                    <div className="h-3 w-36 bg-muted/50 rounded animate-pulse mb-2" />
                    <div className="h-2.5 w-24 bg-muted/30 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : !contactsData || contactsData.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-card border border-border/60 rounded-2xl px-6">
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
              <div className="border border-border/60 rounded-xl bg-card overflow-hidden px-5">
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

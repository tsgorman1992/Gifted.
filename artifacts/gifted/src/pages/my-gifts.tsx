import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Gift, ExternalLink, CheckCircle2, Clock, Plus, Copy,
  Check, Sparkles, TrendingUp, Heart, Star,
  DollarSign, Package, Flower2, Snowflake, Sun,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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
  redeemedAt: string | null;
  createdAt: string;
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
};

const DEFAULT_EXP = { label: "gifted.", color: "hsl(28,62%,36%)", bg: "hsl(28,62%,36%,0.08)", Icon: Gift };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

async function fetchMyGifts(): Promise<GiftSummary[]> {
  const res = await fetch(`${BASE}/api/gifted/my-gifts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load gifts");
  return res.json();
}

type GiftStatus = "draft" | "sent" | "redeemed";

function getStatus(gift: GiftSummary): GiftStatus {
  if (gift.redeemedAt) return "redeemed";
  if (gift.paid) return "sent";
  return "draft";
}

const STATUS_META: Record<GiftStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: "Draft",    color: "#92400e", bg: "#fef3c7" },
  sent:     { label: "Sent",     color: "#1d4ed8", bg: "#dbeafe" },
  redeemed: { label: "Redeemed", color: "#15803d", bg: "#dcfce7" },
};

function greeting(firstName: string | null) {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${time}, ${firstName}` : time;
}

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

// ─── Gift card ────────────────────────────────────────────────────────────────

function GiftCard({ gift, idx }: { gift: GiftSummary; idx: number }) {
  const exp = EXPERIENCE_META[gift.experience] ?? DEFAULT_EXP;
  const status = getStatus(gift);
  const statusMeta = STATUS_META[status];
  const shareUrl = `${window.location.origin}${BASE}/open/${gift.id}`;
  const ExpIcon = exp.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + idx * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="flex items-stretch">
        {/* Left experience accent */}
        <div
          className="w-1.5 shrink-0"
          style={{ background: exp.color }}
        />

        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Experience badge */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: exp.bg }}
              >
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

            {/* Amount badge */}
            {gift.amount && parseFloat(gift.amount) > 0 && (
              <div className="shrink-0 bg-primary/10 text-primary font-semibold text-sm px-3 py-1 rounded-full border border-primary/20">
                ${parseFloat(gift.amount).toFixed(0)}
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status pill */}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ color: statusMeta.color, background: statusMeta.bg }}
              >
                {status === "redeemed" && "✓ "}
                {statusMeta.label}
              </span>
              {/* Experience label */}
              <span className="text-xs text-muted-foreground hidden sm:block">{exp.label}</span>
              {/* Date */}
              <span className="text-xs text-muted-foreground">
                {status === "redeemed" && gift.redeemedAt
                  ? `Redeemed ${formatDistanceToNow(new Date(gift.redeemedAt), { addSuffix: true })}`
                  : format(new Date(gift.createdAt), "MMM d, yyyy")}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <CopyButton url={shareUrl} />
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Preview gift"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyGiftsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myGifts, isLoading: giftsLoading } = useQuery({
    queryKey: ["my-gifts"],
    queryFn: fetchMyGifts,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // ── Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  // ── Not signed in
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
            Sign in to see all the gifts you've sent, track when they've been opened, and manage your gifting history.
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
          <Link href="/create">
            <Button size="lg" variant="outline" className="rounded-full px-10 h-13 w-full sm:w-auto">
              Send a gift
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Stats
  const totalSent = myGifts?.length ?? 0;
  const totalValue = myGifts?.filter(g => g.paid).reduce((sum, g) => sum + (parseFloat(g.amount ?? "0") || 0), 0) ?? 0;
  const awaitingOpen = myGifts?.filter(g => g.paid && !g.redeemedAt).length ?? 0;
  const redeemed = myGifts?.filter(g => !!g.redeemedAt).length ?? 0;

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map(n => n![0])
    .join("")
    .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "?");

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
              <img
                src={user.profileImageUrl}
                alt=""
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <span className="text-primary font-bold text-base">{initials}</span>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground font-medium">{greeting(user?.firstName ?? null)}</p>
              <h1 className="font-serif text-2xl md:text-3xl font-medium leading-tight">Your gifts</h1>
            </div>
          </div>
          <Link href="/create">
            <Button className="rounded-full px-5 gap-2 hidden sm:flex shadow-md hover:-translate-y-0.5 transition-transform">
              <Plus className="w-4 h-4" />
              New gift
            </Button>
          </Link>
        </motion.div>

        {/* ── Stats row ── */}
        {!giftsLoading && totalSent > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Sent" value={totalSent} Icon={Package} delay={0.05} />
            <StatCard label="Total gifted" value={totalValue > 0 ? `$${totalValue.toFixed(0)}` : "—"} Icon={DollarSign} delay={0.1} />
            <StatCard label="Awaiting open" value={awaitingOpen} sub={awaitingOpen === 1 ? "not yet opened" : "not yet opened"} Icon={Clock} delay={0.15} />
            <StatCard label="Redeemed" value={redeemed} Icon={CheckCircle2} delay={0.2} />
          </div>
        )}

        {/* ── Gift list ── */}
        {giftsLoading ? (
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
            <Link href="/create">
              <Button className="rounded-full px-8 h-12 gap-2 shadow-md">
                <Plus className="w-4 h-4" />
                Send your first gift
              </Button>
            </Link>
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
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <Link href="/create">
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
          className="fixed bottom-6 right-6 sm:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </Link>
    </div>
  );
}

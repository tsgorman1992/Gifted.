import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Gift, DollarSign, Clock, CheckCircle2, RefreshCw, LogOut,
  ExternalLink, Copy, Check, Users, BadgeCheck, X,
  TrendingUp, Percent, Repeat2, Sparkles, Search, Trash2,
  AlertTriangle, ChevronDown, ChevronUp, BarChart2, ArrowLeft,
  ArrowLeftRight, UserX, UserCheck, ShieldOff,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API  = `${window.location.origin}${BASE}`;

interface Stats {
  total: number;
  paid: number;
  redeemed: number;
  pending: number;
  volume: number;
  pendingVolume: number;
  feeRevenue: number;
  avgAmount: number;
  totalUsers: number;
  newUsersWeek: number;
  openRate: number;
  redeemRate: number;
  repeatSenders: number;
  topExperience: string | null;
}

interface Cashout {
  id: string;
  recipientName: string;
  senderName: string;
  amount: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  payoutName: string | null;
  redeemedAt: string | null;
  cashoutPaidAt: string | null;
  createdAt: string;
}

interface GiftRow {
  id: string;
  recipientName: string;
  senderName: string;
  amount: string | null;
  paid: boolean;
  experience: string;
  occasion: string;
  openedAt: string | null;
  redeemedAt: string | null;
  cashoutPaidAt: string | null;
  createdAt: string;
  senderEmail: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  reaction: string | null;
  recipientUserId: string | null;
  senderUserId: string | null;
  redemptionVerified: boolean;
}

interface TransferUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface UserRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  createdAt: string;
  giftsSent: number;
  giftsReceived: number;
}

interface MonthRow {
  month: string;
  giftCount: number;
  volume: number;
  feeRevenue: number;
  opens: number;
  redeems: number;
  openRate: number;
  redeemRate: number;
  newUsers: number;
}

interface TrendsData {
  monthly: MonthRow[];
  experienceBreakdown: { name: string; count: number }[];
  occasionBreakdown:   { name: string; count: number }[];
}

interface EmailDripUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  dripStep: number;
  dripLastSentAt: string | null;
  createdAt: string;
  emailBounced: boolean;
  emailComplained: boolean;
  unsubscribedMarketing: boolean;
  firstSentAt: string | null;
  firstSentSource: string | null;
}

interface EmailLogEntry {
  type: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  sentAt: string;
  status: string;
}

interface EmailCampaignData {
  pipeline: {
    step0Eligible: number;
    step1: number;
    step2: number;
    step3: number;
    converted: number;
  };
  users: EmailDripUser[];
  logs: EmailLogEntry[];
}

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle",
};
const METHOD_COLORS: Record<string, string> = {
  venmo: "#008CFF", cashapp: "#00D632", paypal: "#003087", zelle: "#6D1ED4",
};
const EXP_LABELS: Record<string, string> = {
  "confetti-burst": "Confetti Burst",
  "golden-hour":    "Golden Hour",
  "garden-bloom":   "Garden Bloom",
  "midnight-stars": "Midnight Stars",
  "rose-petal":     "Rose Petal",
  "snow-flurry":    "Snow Flurry",
  "sunrise":        "Sunrise",
  "mothers-day":    "For Mom",
  "fathers-day":    "For Dad",
  "smoke-amber":    "Smoke & Amber",
  "carbon-steel":   "Carbon & Steel",
  "electric-night": "Electric Night",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function fmtAmt(a: string | null) {
  if (!a) return "—";
  return `$${parseFloat(a).toFixed(2)}`;
}

function MethodBadge({ method, handle }: { method: string; handle: string | null }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
        style={{ background: METHOD_COLORS[method] ?? "#888" }}>
        {METHOD_LABELS[method] ?? method}
      </span>
      {handle && <span className="text-sm font-mono">{handle}</span>}
    </div>
  );
}

function StatusBadge({ gift }: { gift: GiftRow }) {
  if (gift.redeemedAt && gift.cashoutPaidAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">Paid out</span>;
  if (gift.redeemedAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">Needs payout</span>;
  if (gift.openedAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">Opened</span>;
  if (gift.paid)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">Awaiting recipient</span>;
  return   <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground whitespace-nowrap">Draft</span>;
}

function StatCard({
  label, value, sub, icon: Icon, color, onClick,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; color: string;
  onClick?: () => void;
}) {
  const isClickable = !!onClick;
  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); } : undefined}
      className={`bg-card border border-border rounded-2xl p-4 sm:p-5 transition-all ${
        isClickable
          ? "cursor-pointer hover:border-primary/40 hover:shadow-sm hover:bg-card/80 group"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
        <div className="flex items-center gap-1">
          <Icon className={`w-4 h-4 shrink-0 ${color}`} />
          {isClickable && (
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          )}
        </div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIMARY = "#8C5523";   // brand cognac — hsl(28,62%,36%)
const GREEN   = "#16a34a";
const BLUE    = "#2563eb";
const VIOLET  = "#7c3aed";
const SKY     = "#0ea5e9";

function fmtMonth(m: string) {
  const [year, month] = m.split("-");
  const d = new Date(+year, +month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" }) + " '" + year.slice(2);
}

function ChartCard({ title, children, isEmpty }: { title: string; children: React.ReactNode; isEmpty?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">{title}</h3>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40 gap-2">
          <BarChart2 className="w-8 h-8" />
          <span className="text-xs">No data yet</span>
        </div>
      ) : children}
    </div>
  );
}

function TrendsPanel({
  trends, loading, error, expLabels,
}: {
  trends: TrendsData | null;
  loading: boolean;
  error: string | null;
  expLabels: Record<string, string>;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading trends…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-destructive/70">
        <AlertTriangle className="w-6 h-6" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!trends) return null;

  const chartData = trends.monthly.map(m => ({ ...m, label: fmtMonth(m.month) }));
  const hasGiftData  = chartData.some(m => m.giftCount > 0);
  const hasUserData  = chartData.some(m => m.newUsers > 0);
  const hasRateData  = chartData.some(m => m.openRate > 0 || m.redeemRate > 0);
  const hasExpData   = trends.experienceBreakdown.length > 0;
  const hasOccData   = trends.occasionBreakdown.length > 0;

  const expData = trends.experienceBreakdown.map(e => ({
    name:  expLabels[e.name] ?? e.name,
    count: e.count,
  }));
  const occData = trends.occasionBreakdown;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: "12px",
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Volume + Gift Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Monthly Volume ($)" isEmpty={!hasGiftData}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Volume"]}
                />
                <Bar dataKey="volume" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Gifts Sent per Month" isEmpty={!hasGiftData}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(v: number) => [v, "Gifts"]}
                />
                <Bar dataKey="giftCount" fill={VIOLET} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Open/Redeem Rates + New Signups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Open & Redeem Rate (%)" isEmpty={!hasRateData}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(v: number, name: string) => [`${v}%`, name === "openRate" ? "Open rate" : "Redeem rate"]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }}
                  formatter={(val) => val === "openRate" ? "Open rate" : "Redeem rate"} />
                <Line type="monotone" dataKey="openRate"   stroke={BLUE}  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="redeemRate" stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="New Signups per Month" isEmpty={!hasUserData}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(v: number) => [v, "New users"]}
                />
                <Bar dataKey="newUsers" fill={SKY} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Experience + Occasion breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Experience Themes (all time)" isEmpty={!hasExpData}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={expData} margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Gifts"]} />
                <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Occasions (all time)" isEmpty={!hasOccData}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={occData} margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Gifts"]} />
                <Bar dataKey="count" fill={SKY} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <p className="text-xs text-muted-foreground text-right pb-2">Last 12 months • All paid gifts</p>
    </div>
  );
}

// ── Drilldown modal ────────────────────────────────────────────────────────────
function DrilldownModal({
  type, onClose, giftRows,
}: {
  type: "fee" | "repeats";
  onClose: () => void;
  giftRows: GiftRow[];
}) {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";

  const amt = (g: GiftRow) => parseFloat(g.amount ?? "0") || 0;

  // Fee breakdown — paid gifts only, newest first
  const feeRows = React.useMemo(
    () =>
      giftRows
        .filter(g => g.paid && g.amount != null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [giftRows]
  );
  const totalVolume = feeRows.reduce((s, g) => s + amt(g), 0);
  const totalFee    = totalVolume * 0.08;

  // Repeat senders — senders with > 1 paid gift
  const repeatRows = React.useMemo(() => {
    const map: Record<string, { name: string; email: string; count: number; total: number }> = {};
    for (const g of giftRows) {
      if (!g.paid) continue;
      const key = g.senderEmail ?? g.senderName;
      if (!map[key]) map[key] = { name: g.senderName, email: g.senderEmail ?? "—", count: 0, total: 0 };
      map[key].count++;
      map[key].total += amt(g);
    }
    return Object.values(map)
      .filter(r => r.count > 1)
      .sort((a, b) => b.count - a.count || b.total - a.total);
  }, [giftRows]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">
              {type === "fee" ? "Revenue Breakdown" : "Repeat Senders"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {type === "fee"
                ? `${feeRows.length} paid gift${feeRows.length !== 1 ? "s" : ""} · 8% platform fee`
                : `${repeatRows.length} sender${repeatRows.length !== 1 ? "s" : ""} sent more than once`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1">
          {type === "fee" && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Date</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Recipient</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap hidden sm:table-cell">Sender</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Amount</th>
                  <th className="text-right text-[11px] font-semibold text-green-700 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Fee (8%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {feeRows.map(g => (
                  <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{g.recipientName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate hidden sm:table-cell">{g.senderName}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(amt(g))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">{fmt(amt(g) * 0.08)}</td>
                  </tr>
                ))}
                {feeRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No paid gifts yet</td></tr>
                )}
              </tbody>
              {feeRows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-card border-t border-border">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Total</td>
                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sm:hidden">Total</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{fmt(totalVolume)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600 tabular-nums">{fmt(totalFee)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {type === "repeats" && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5">Sender</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 hidden sm:table-cell">Email</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Moments</th>
                  <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Total Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {repeatRows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate hidden sm:table-cell">{r.email}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {r.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums">{fmt(r.total)}</td>
                  </tr>
                ))}
                {repeatRows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">No repeat senders yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [key, setKey]           = useState(() => sessionStorage.getItem("admin_key") ?? "");
  const [authed, setAuthed]     = useState(false);
  const [checking, setChecking] = useState(false);
  const [authErr, setAuthErr]   = useState("");

  const [stats, setStats]       = useState<Stats | null>(null);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [giftRows, setGiftRows] = useState<GiftRow[]>([]);
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState<"cashouts" | "all" | "users" | "trends" | "email">("cashouts");
  const [copied, setCopied]     = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);

  const [giftSearch, setGiftSearch] = useState("");

  // Drilldown modal
  const [drilldown, setDrilldown] = useState<"fee" | "repeats" | null>(null);

  // Trends tab — lazy loaded
  const [trends, setTrends]           = useState<TrendsData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsLoaded, setTrendsLoaded]   = useState(false);
  const [trendsError, setTrendsError]     = useState<string | null>(null);

  // Email campaign tab — lazy loaded
  const [emailData, setEmailData]       = useState<EmailCampaignData | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailLoaded, setEmailLoaded]   = useState(false);
  const [emailError, setEmailError]     = useState<string | null>(null);

  const [showWipe, setShowWipe]   = useState(false);
  const [wipeInput, setWipeInput] = useState("");
  const [wiping, setWiping]       = useState(false);
  const [wipeMsg, setWipeMsg]     = useState<string | null>(null);

  // Ghost draft cleanup
  const [ghostCount, setGhostCount]       = useState<number | null>(null);
  const [ghostConfirm, setGhostConfirm]   = useState(false);
  const [ghostCleaning, setGhostCleaning] = useState(false);
  const [ghostMsg, setGhostMsg]           = useState<string | null>(null);

  // Transfer recipient modal
  const [transferGiftId, setTransferGiftId]             = useState<string | null>(null);
  const [transferGiftName, setTransferGiftName]         = useState("");
  const [transferCurrentRecipient, setTransferCurrentRecipient] = useState<TransferUser | null>(null);
  const [transferEmail, setTransferEmail]               = useState("");
  const [transferResults, setTransferResults]           = useState<TransferUser[]>([]);
  const [transferSelected, setTransferSelected]         = useState<TransferUser | null>(null);
  const [transferSearching, setTransferSearching]       = useState(false);
  const [transferring, setTransferring]                 = useState(false);
  const [transferMsg, setTransferMsg]                   = useState<{ type: "success" | "error"; text: string } | null>(null);

  const headers = { "x-admin-key": key };

  const loadTrends = useCallback(async (force = false) => {
    if (trendsLoaded && !force) return;
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const r = await fetch(`${API}/api/admin/trends`, { headers });
      if (!r.ok) { setTrendsError("Failed to load trends. Try refreshing."); return; }
      const data = await r.json() as TrendsData;
      if (!Array.isArray(data?.monthly)) { setTrendsError("Unexpected response from server."); return; }
      setTrends(data);
      setTrendsLoaded(true);
    } catch {
      setTrendsError("Could not connect. Try refreshing.");
    } finally {
      setTrendsLoading(false);
    }
  }, [key, trendsLoaded]);

  const loadEmailData = useCallback(async (force = false) => {
    if (emailLoaded && !force) return;
    setEmailLoading(true);
    setEmailError(null);
    try {
      const r = await fetch(`${API}/api/internal/email-campaign`, { headers });
      if (!r.ok) { setEmailError("Failed to load email data. Try refreshing."); return; }
      const data = await r.json() as EmailCampaignData;
      setEmailData(data);
      setEmailLoaded(true);
    } catch {
      setEmailError("Could not connect. Try refreshing.");
    } finally {
      setEmailLoading(false);
    }
  }, [key, emailLoaded]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadGhostCount = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/ghost-drafts`, { headers });
      if (r.ok) { const d = await r.json(); setGhostCount(Number(d.count ?? 0)); }
    } catch { /* silent */ }
  }, [key]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, c, g, u] = await Promise.all([
        fetch(`${API}/api/admin/stats`,    { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/cashouts`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/gifts`,    { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/users`,    { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setCashouts(Array.isArray(c) ? c : []);
      setGiftRows(Array.isArray(g) ? g : []);
      setUserRows(Array.isArray(u) ? u : []);
      setLastUpdated(new Date());
      loadGhostCount();
    } finally {
      if (!silent) setLoading(false);
    }
  }, [key, loadGhostCount]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true); setAuthErr("");
    try {
      const r = await fetch(`${API}/api/admin/stats`, { headers: { "x-admin-key": key } });
      if (r.status === 401 || r.status === 503) {
        setAuthErr("Incorrect password."); setChecking(false); return;
      }
      sessionStorage.setItem("admin_key", key);
      setAuthed(true);
    } catch { setAuthErr("Could not connect."); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    if (!authed) return;
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [authed, load]);

  function copyHandle(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text); setTimeout(() => setCopied(null), 2000);
    });
  }

  async function markCashoutPaid(id: string) {
    setMarkingPaid(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}/mark-cashout-paid`, { method: "PATCH", headers });
      if (r.ok) {
        const now = new Date().toISOString();
        setCashouts(prev => prev.map(c => c.id === id ? { ...c, cashoutPaidAt: now } : c));
        setGiftRows(prev => prev.map(g => g.id === id ? { ...g, cashoutPaidAt: now } : g));
        if (stats) setStats({ ...stats, pending: Math.max(0, stats.pending - 1), pendingVolume: 0 });
      }
    } finally { setMarkingPaid(null); }
  }

  const [markingGiftPaid, setMarkingGiftPaid] = useState<string | null>(null);
  async function markGiftAsPaid(id: string) {
    setMarkingGiftPaid(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}/mark-paid`, { method: "PATCH", headers });
      if (r.ok) {
        setGiftRows(prev => prev.map(g => g.id === id ? { ...g, paid: true } : g));
      }
    } finally { setMarkingGiftPaid(null); }
  }

  const [deletingGift, setDeletingGift] = useState<string | null>(null);
  async function deleteGift(id: string, recipientName: string) {
    if (!window.confirm(`Permanently delete gift for ${recipientName}? This cannot be undone.`)) return;
    setDeletingGift(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}`, { method: "DELETE", headers });
      if (r.ok) {
        setGiftRows(prev => prev.filter(g => g.id !== id));
        setCashouts(prev => prev.filter(c => c.id !== id));
      }
    } finally { setDeletingGift(null); }
  }

  const [bypassingVerification, setBypassingVerification] = useState<string | null>(null);
  async function bypassVerification(id: string, recipientName: string) {
    if (!window.confirm(`Bypass phone verification for ${recipientName}? They'll be able to redeem without entering a code.`)) return;
    setBypassingVerification(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}/bypass-verification`, { method: "POST", headers });
      if (r.ok) {
        setGiftRows(prev => prev.map(g => g.id === id ? { ...g, redemptionVerified: true } : g));
      }
    } finally { setBypassingVerification(null); }
  }

  async function handleGhostCleanup() {
    setGhostCleaning(true);
    setGhostMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/ghost-drafts`, { method: "DELETE", headers });
      if (r.ok) {
        const d = await r.json();
        setGhostMsg(`Deleted ${d.deleted} orphaned draft${d.deleted !== 1 ? "s" : ""}.`);
        setGhostConfirm(false);
        await Promise.all([load(true), loadGhostCount()]);
        setTimeout(() => setGhostMsg(null), 4000);
      } else {
        setGhostMsg("Cleanup failed. Try again.");
      }
    } catch {
      setGhostMsg("Could not connect. Try again.");
    } finally {
      setGhostCleaning(false);
    }
  }

  async function handleWipe() {
    if (wipeInput !== "WIPE") return;
    setWiping(true); setWipeMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/wipe`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "WIPE" }),
      });
      if (r.ok) {
        setWipeMsg("All gift data wiped successfully.");
        setCashouts([]); setGiftRows([]);
        if (stats) setStats({
          ...stats, total: 0, paid: 0, redeemed: 0, pending: 0,
          volume: 0, pendingVolume: 0, feeRevenue: 0, avgAmount: 0,
          openRate: 0, redeemRate: 0, repeatSenders: 0, topExperience: null,
        });
        setWipeInput("");
        setTimeout(() => { setShowWipe(false); setWipeMsg(null); }, 3000);
      } else {
        setWipeMsg("Wipe failed. Try again.");
      }
    } finally { setWiping(false); }
  }

  function openTransferModal(gift: GiftRow) {
    setTransferGiftId(gift.id);
    setTransferGiftName(gift.recipientName);
    setTransferEmail("");
    setTransferResults([]);
    setTransferSelected(null);
    setTransferMsg(null);
    // Look up who currently holds this gift from the already-loaded user list
    if (gift.recipientUserId) {
      const match = userRows.find(u => u.id === gift.recipientUserId);
      setTransferCurrentRecipient(
        match
          ? { id: match.id, email: match.email, displayName: match.displayName }
          : { id: gift.recipientUserId, email: null, displayName: null }
      );
    } else {
      setTransferCurrentRecipient(null);
    }
  }

  function closeTransferModal() {
    setTransferGiftId(null);
    setTransferCurrentRecipient(null);
    setTransferEmail("");
    setTransferResults([]);
    setTransferSelected(null);
    setTransferMsg(null);
  }

  async function searchTransferUsers(email: string) {
    setTransferEmail(email);
    setTransferSelected(null);
    if (!email.trim()) { setTransferResults([]); return; }
    setTransferSearching(true);
    try {
      const r = await fetch(`${API}/api/admin/users/search?email=${encodeURIComponent(email.trim())}`, { headers });
      if (r.ok) setTransferResults(await r.json());
    } catch { /* silent */ }
    finally { setTransferSearching(false); }
  }

  async function handleTransferRecipient(recipientUserId: string | null) {
    if (!transferGiftId) return;
    setTransferring(true);
    setTransferMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${transferGiftId}/set-recipient`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserId }),
      });
      if (r.ok) {
        const data = await r.json();
        setTransferMsg({
          type: "success",
          text: recipientUserId
            ? `Transferred to ${data.recipientEmail}`
            : "Recipient cleared — they can re-claim the gift",
        });
        setGiftRows(prev =>
          prev.map(g => g.id === transferGiftId ? { ...g, recipientUserId } : g)
        );
        setTimeout(() => closeTransferModal(), 2500);
      } else {
        const e = await r.json().catch(() => ({}));
        setTransferMsg({ type: "error", text: e.error ?? "Transfer failed" });
      }
    } catch {
      setTransferMsg({ type: "error", text: "Could not connect" });
    } finally { setTransferring(false); }
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl font-medium text-center mb-1">gifted.</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Operator dashboard</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Admin password"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              autoComplete="new-password"
            />
            {authErr && <p className="text-sm text-destructive">{authErr}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={checking || !key}>
              {checking ? "Checking…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const pendingCashouts = cashouts.filter(c => !c.cashoutPaidAt);
  const paidCashouts    = cashouts.filter(c => !!c.cashoutPaidAt);

  const filteredGifts = giftSearch.trim()
    ? giftRows.filter(g =>
        g.recipientName.toLowerCase().includes(giftSearch.toLowerCase()) ||
        g.senderName.toLowerCase().includes(giftSearch.toLowerCase()) ||
        (g.senderEmail ?? "").toLowerCase().includes(giftSearch.toLowerCase())
      )
    : giftRows;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Admin header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/my-gifts"
              title="Back to platform"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <h1 className="font-serif text-lg font-medium whitespace-nowrap">gifted.</h1>
            <span className="text-muted-foreground text-xs font-medium px-2 py-0.5 bg-muted rounded-full whitespace-nowrap">operator</span>
          </div>
          <div className="flex items-center gap-1.5">
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground/60 hidden sm:block whitespace-nowrap">
                {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => { load(); loadTrends(true); }}
              disabled={loading}
              title="Refresh"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowWipe(true)}
              title="Wipe gift data"
              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { sessionStorage.removeItem("admin_key"); setAuthed(false); }}
              title="Sign out"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {stats && (
          <div className="space-y-3">
            {/* Primary row — 4 cards, clean 2×2 on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Accounts"     value={`${stats.totalUsers}`}             sub={`+${stats.newUsersWeek} this week`}        icon={Users}       color="text-violet-600" onClick={() => setTab("users")} />
              <StatCard label="Total gifts"  value={`${stats.total}`}                  sub={`${stats.paid} paid`}                       icon={Gift}        color="text-foreground" onClick={() => setTab("all")} />
              <StatCard label="Gross volume" value={`$${stats.volume.toFixed(2)}`}      sub={`avg $${stats.avgAmount.toFixed(0)} / gift`} icon={DollarSign}  color="text-primary"    onClick={() => setDrilldown("fee")} />
              <StatCard label="Fee revenue"  value={`$${stats.feeRevenue.toFixed(2)}`}  sub="8% of gross"                                icon={TrendingUp}  color="text-green-600"  onClick={() => setDrilldown("fee")} />
            </div>
            {/* Insights row — 4 cards, same grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Open rate"      value={`${stats.openRate}%`}    sub="of paid gifts opened"       icon={Percent}  color="text-blue-600"   />
              <StatCard label="Redeem rate"    value={`${stats.redeemRate}%`}  sub="of opened gifts redeemed"   icon={Percent}  color="text-green-600"  />
              <StatCard label="Repeat senders" value={`${stats.repeatSenders}`} sub="sent more than once"       icon={Repeat2}  color="text-primary"    onClick={() => setDrilldown("repeats")} />
              <StatCard
                label="Top theme"
                value={stats.topExperience ? (EXP_LABELS[stats.topExperience] ?? stats.topExperience) : "—"}
                sub="most chosen experience"
                icon={Sparkles}
                color="text-violet-600"
                onClick={() => setTab("trends")}
              />
            </div>
          </div>
        )}

        {/* ── Pending payout alert ─────────────────────────────────────── */}
        {stats && stats.pendingVolume > 0 && (
          <button
            onClick={() => setTab("cashouts")}
            className="w-full flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 sm:px-5 py-4 text-left hover:bg-amber-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {pendingCashouts.length} payout{pendingCashouts.length !== 1 ? "s" : ""} waiting
                </p>
                <p className="text-xs text-amber-700">${stats.pendingVolume.toFixed(2)} to send</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-700 group-hover:text-amber-900 whitespace-nowrap">
              View cashouts →
            </span>
          </button>
        )}

        {/* ── Ghost draft cleanup ──────────────────────────────────── */}
        {ghostCount !== null && ghostCount > 0 && (
          <div className="flex items-center justify-between gap-3 bg-muted/50 border border-border rounded-2xl px-4 sm:px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{ghostCount}</span> orphaned draft{ghostCount !== 1 ? "s" : ""} older than 14 days
              </p>
            </div>
            {ghostMsg ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">{ghostMsg}</span>
            ) : ghostConfirm ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setGhostConfirm(false)}
                  className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                  disabled={ghostCleaning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGhostCleanup}
                  disabled={ghostCleaning}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {ghostCleaning ? "Deleting…" : `Delete ${ghostCount}`}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setGhostConfirm(true)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
              >
                Clean up →
              </button>
            )}
          </div>
        )}
        {ghostMsg && ghostCount === 0 && (
          <p className="text-xs text-muted-foreground text-center">{ghostMsg}</p>
        )}

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-0 border-b border-border min-w-max px-4 sm:px-0 sm:min-w-0">
            {([
              ["cashouts", "Cashouts",  pendingCashouts.length > 0 ? String(pendingCashouts.length) : null, "amber"],
              ["all",      "All Gifts", String(giftRows.length), "muted"],
              ["users",    "Accounts",  String(userRows.length), "violet"],
              ["trends",   "Trends",    null,                    "none"],
              ["email",    "Email",     null,                    "none"],
            ] as const).map(([t, label, badge, badgeColor]) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t as typeof tab);
                  if (t === "trends") loadTrends();
                  if (t === "email") loadEmailData();
                }}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2 ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {badge && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                    badgeColor === "amber"  ? "bg-amber-100 text-amber-800" :
                    badgeColor === "violet" ? "bg-violet-100 text-violet-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Cashouts tab ─────────────────────────────────────────────── */}
        {tab === "cashouts" && (
          <div className="space-y-4">

            {/* Pending */}
            {pendingCashouts.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
                <p className="text-sm text-muted-foreground font-medium">All caught up — no pending payouts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCashouts.map(c => (
                  <div key={c.id} className="bg-card border border-amber-200 rounded-2xl p-4 sm:p-5">
                    {/* Top row: names + amount */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-base leading-tight">{c.recipientName}</p>
                        <p className="text-muted-foreground text-sm">from {c.senderName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Redeemed {fmt(c.redeemedAt)}</p>
                      </div>
                      <span className="font-bold text-primary text-xl shrink-0">{fmtAmt(c.amount)}</span>
                    </div>

                    {/* Bottom row: payout info + actions */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        {c.payoutMethod ? (
                          <button
                            onClick={() => copyHandle(c.payoutHandle ?? "")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            title="Copy handle"
                          >
                            <MethodBadge method={c.payoutMethod} handle={c.payoutHandle} />
                            {copied === c.payoutHandle
                              ? <Check className="w-3.5 h-3.5 text-green-600" />
                              : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No payout method set</span>
                        )}
                        {c.payoutName && <p className="text-xs text-muted-foreground mt-0.5">{c.payoutName}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/open/${c.id}?preview=true`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                          title="View gift"
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                        <Button
                          size="sm"
                          onClick={() => markCashoutPaid(c.id)}
                          disabled={markingPaid === c.id}
                          className="gap-1.5 h-9 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
                        >
                          {markingPaid === c.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <BadgeCheck className="w-3.5 h-3.5" />}
                          Mark paid
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paid history (collapsible) */}
            {paidCashouts.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPaidHistory(v => !v)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-1"
                >
                  {showPaidHistory
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />}
                  {showPaidHistory ? "Hide" : "Show"} {paidCashouts.length} paid cashout{paidCashouts.length !== 1 ? "s" : ""}
                </button>
                {showPaidHistory && (
                  <div className="space-y-2">
                    {paidCashouts.map(c => (
                      <div key={c.id} className="bg-card border border-border rounded-2xl p-4 opacity-60">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium text-sm">{c.recipientName}</span>
                              <span className="text-muted-foreground text-sm"> · {fmtAmt(c.amount)}</span>
                              <p className="text-xs text-muted-foreground">Paid {fmt(c.cashoutPaidAt)}</p>
                            </div>
                          </div>
                          {c.payoutMethod && (
                            <MethodBadge method={c.payoutMethod} handle={c.payoutHandle} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── All Gifts tab ─────────────────────────────────────────────── */}
        {tab === "all" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={giftSearch}
                onChange={e => setGiftSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {giftSearch && (
                <button
                  onClick={() => setGiftSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {giftSearch && (
              <p className="text-xs text-muted-foreground">
                {filteredGifts.length} of {giftRows.length} gifts
              </p>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Recipient", "Sender", "Amount", "Status", "React", "Theme", "Date", ""].map(h => (
                      <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap first:pl-4 sm:first:pl-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGifts.map((g, i) => (
                    <tr key={g.id}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {g.recipientName}
                          {g.recipientUserId && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Claimed by an account" />
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 select-all">{g.id}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground whitespace-nowrap">{g.senderName}</td>
                      <td className="px-3 sm:px-4 py-3 font-semibold text-primary whitespace-nowrap">{fmtAmt(g.amount)}</td>
                      <td className="px-3 sm:px-4 py-3"><StatusBadge gift={g} /></td>
                      <td className="px-3 sm:px-4 py-3 text-base">{g.reaction ?? ""}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{EXP_LABELS[g.experience] ?? g.experience}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openTransferModal(g)}
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            title="Transfer / reassign recipient"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <a href={`/open/${g.id}?preview=true`} target="_blank" rel="noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors p-1 block">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <div className="flex items-center ml-2 pl-2 border-l border-border gap-1">
                            {!g.paid && g.amount && parseFloat(g.amount) > 0 && (
                              <button
                                onClick={() => markGiftAsPaid(g.id)}
                                disabled={markingGiftPaid === g.id}
                                className="text-amber-600 hover:text-amber-700 transition-colors p-1.5"
                                title="Mark gift as paid (use when Stripe webhook missed)"
                              >
                                {markingGiftPaid === g.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <BadgeCheck className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {g.openedAt && !g.redeemedAt && !g.redemptionVerified && (
                              <button
                                onClick={() => bypassVerification(g.id, g.recipientName)}
                                disabled={bypassingVerification === g.id}
                                className="text-sky-500 hover:text-sky-600 transition-colors p-1.5"
                                title="Bypass phone verification (use when recipient can't receive the SMS code)"
                              >
                                {bypassingVerification === g.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <ShieldOff className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => deleteGift(g.id, g.recipientName)}
                              disabled={deletingGift === g.id}
                              className="text-destructive/40 hover:text-destructive transition-colors p-1.5"
                              title="Permanently delete this gift"
                            >
                              {deletingGift === g.id
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredGifts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        {giftSearch ? "No gifts match that search" : "No gifts yet"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Accounts tab ──────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Name", "Email", "Payout", "Joined", "Sent", "Rcvd"].map(h => (
                    <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userRows.map((u, i) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || "—";
                  return (
                    <tr key={u.id}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">{name}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{u.email ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {u.payoutMethod
                          ? <MethodBadge method={u.payoutMethod} handle={u.payoutHandle} />
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          u.giftsSent > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                        }`}>{u.giftsSent}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          u.giftsReceived > 0 ? "bg-green-100 text-green-700" : "text-muted-foreground"
                        }`}>{u.giftsReceived}</span>
                      </td>
                    </tr>
                  );
                })}
                {userRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No accounts yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Trends tab ────────────────────────────────────────────────── */}
        {tab === "trends" && (
          <TrendsPanel trends={trends} loading={trendsLoading} error={trendsError} expLabels={EXP_LABELS} />
        )}

        {/* ── Email campaign tab ────────────────────────────────────────── */}
        {tab === "email" && (
          <div className="space-y-8">
            {emailLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading email data…</p>
              </div>
            ) : emailError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-destructive/70">
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm">{emailError}</p>
              </div>
            ) : emailData ? (
              <>
                {/* Pipeline funnel */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Drip sequence pipeline</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {([
                      { label: "Eligible for Email 1", value: emailData.pipeline.step0Eligible, sub: "account 3+ days, no gift sent", color: "text-muted-foreground" },
                      { label: "Email 1 sent",          value: emailData.pipeline.step1,         sub: '"Someone built you something"',   color: "text-blue-600" },
                      { label: "Email 2 sent",          value: emailData.pipeline.step2,         sub: '"You already know who."',          color: "text-violet-600" },
                      { label: "Email 3 sent",          value: emailData.pipeline.step3,         sub: "Occasions nudge",                 color: "text-green-600" },
                      { label: "Converted",             value: emailData.pipeline.converted,     sub: "sent a paid gift",                color: "text-primary" },
                    ] as const).map(({ label, value, sub, color }) => (
                      <div key={label} className="bg-card border border-border rounded-2xl p-4">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight mb-2">{label}</p>
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-tight italic">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User drip state table */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">User drip state ({emailData.users.length})</p>
                  <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["Name", "Email", "Step", "Last email", "Joined", "Status"].map(h => (
                            <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {emailData.users.map((u, i) => {
                          const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
                          const isConverted   = !!u.firstSentAt;
                          const isBounced     = u.emailBounced || u.emailComplained;
                          const isUnsub       = u.unsubscribedMarketing;
                          const stepMeta: Record<number, { label: string; cls: string }> = {
                            0: { label: "Eligible",   cls: "bg-muted text-muted-foreground" },
                            1: { label: "Email 1 ✓",  cls: "bg-blue-100 text-blue-700" },
                            2: { label: "Email 2 ✓",  cls: "bg-violet-100 text-violet-700" },
                            3: { label: "Email 3 ✓",  cls: "bg-green-100 text-green-700" },
                          };
                          const step = stepMeta[u.dripStep] ?? { label: `Step ${u.dripStep}`, cls: "bg-muted text-muted-foreground" };
                          return (
                            <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                              <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">{name}</td>
                              <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{u.email ?? "—"}</td>
                              <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${step.cls}`}>{step.label}</span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{u.dripLastSentAt ? fmt(u.dripLastSentAt) : "—"}</td>
                              <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(u.createdAt)}</td>
                              <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                {isConverted
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">Converted 🎉</span>
                                  : isBounced
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Bounced</span>
                                  : isUnsub
                                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">Unsubscribed</span>
                                  : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                        {emailData.users.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No users yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Send log */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Send log ({emailData.logs.length} most recent)</p>
                  <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["Type", "Recipient", "Sent", "Status"].map(h => (
                            <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {emailData.logs.map((l, i) => {
                          const name = [l.firstName, l.lastName].filter(Boolean).join(" ");
                          const typeColors: Record<string, string> = {
                            drip1: "bg-blue-100 text-blue-700",
                            drip2: "bg-violet-100 text-violet-700",
                            drip3: "bg-green-100 text-green-700",
                            digest: "bg-amber-100 text-amber-700",
                            abandoned_nudge: "bg-orange-100 text-orange-700",
                          };
                          const typeColor = typeColors[l.type] ?? "bg-muted text-muted-foreground";
                          return (
                            <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                              <td className="px-3 sm:px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${typeColor}`}>{l.type}</span>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                {name && <div className="font-medium text-sm">{name}</div>}
                                <div className="text-xs text-muted-foreground">{l.email}</div>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(l.sentAt)}</td>
                              <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  l.status === "delivered"  ? "bg-green-100 text-green-700"
                                  : l.status === "bounced"  ? "bg-red-100 text-red-700"
                                  : l.status === "complained" ? "bg-orange-100 text-orange-700"
                                  : "bg-muted text-muted-foreground"
                                }`}>{l.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {emailData.logs.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">No emails sent yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pb-4">
                  <button
                    onClick={() => loadEmailData(true)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

      </main>

      {/* ── Wipe modal ───────────────────────────────────────────────────── */}
      {showWipe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Wipe all gift data</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently deletes all gifts, cashouts, and messages.{" "}
                  <span className="font-medium text-foreground">User accounts are kept.</span>
                </p>
              </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              <p className="text-xs text-destructive font-medium">
                This cannot be undone. Type <span className="font-mono font-bold tracking-wider">WIPE</span> to confirm.
              </p>
            </div>

            <input
              type="text"
              placeholder="Type WIPE to confirm"
              value={wipeInput}
              onChange={e => setWipeInput(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30 font-mono tracking-wider"
              autoFocus
            />

            {wipeMsg && (
              <p className={`text-sm font-medium ${wipeMsg.includes("success") ? "text-green-600" : "text-destructive"}`}>
                {wipeMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => { setShowWipe(false); setWipeInput(""); setWipeMsg(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                disabled={wipeInput !== "WIPE" || wiping}
                onClick={handleWipe}
              >
                {wiping ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Wipe all gifts"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer recipient modal ─────────────────────────────────────── */}
      {transferGiftId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-base">Reassign recipient</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Gift for <span className="font-medium text-foreground">{transferGiftName}</span>
                  </p>
                </div>
              </div>
              <button onClick={closeTransferModal} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current assignment status */}
            <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${
              transferCurrentRecipient
                ? "bg-amber-50 border border-amber-200"
                : "bg-muted/50 border border-border"
            }`}>
              {transferCurrentRecipient ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground">Currently claimed by</span>
                  <span className="font-medium text-foreground truncate">
                    {transferCurrentRecipient.displayName
                      ? `${transferCurrentRecipient.displayName} (${transferCurrentRecipient.email ?? "no email"})`
                      : (transferCurrentRecipient.email ?? transferCurrentRecipient.id)}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="text-muted-foreground">Not yet claimed by anyone</span>
                </>
              )}
            </div>

            {/* Clear option — only shown when someone has claimed it */}
            {transferCurrentRecipient && (
              <>
                <button
                  onClick={() => handleTransferRecipient(null)}
                  disabled={transferring}
                  className="w-full flex items-center gap-3 border border-border rounded-xl px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <UserX className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-medium">Clear assignment</p>
                    <p className="text-xs text-muted-foreground">Removes the current recipient so they can re-claim the gift</p>
                  </div>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or transfer to a different account</span></div>
                </div>
              </>
            )}

            {/* Email search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by email…"
                value={transferEmail}
                onChange={e => searchTransferUsers(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus={false}
              />
              {transferSearching && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
              )}
            </div>

            {/* Search results */}
            {transferResults.length > 0 && !transferSelected && (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                {transferResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setTransferSelected(u)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {(u.displayName ?? u.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {u.displayName && <p className="font-medium truncate">{u.displayName}</p>}
                      <p className="text-xs text-muted-foreground truncate">{u.email ?? "No email"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected user — confirm step */}
            {transferSelected && (
              <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {(transferSelected.displayName ?? transferSelected.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {transferSelected.displayName && <p className="font-medium text-sm truncate">{transferSelected.displayName}</p>}
                    <p className="text-xs text-muted-foreground truncate">{transferSelected.email}</p>
                  </div>
                  <button onClick={() => setTransferSelected(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  onClick={() => handleTransferRecipient(transferSelected.id)}
                  disabled={transferring}
                  className="w-full h-10 rounded-xl gap-2"
                >
                  {transferring
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <><UserCheck className="w-4 h-4" /> Confirm transfer</>}
                </Button>
              </div>
            )}

            {/* Result message */}
            {transferMsg && (
              <p className={`text-sm font-medium text-center ${transferMsg.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {transferMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Drilldown modals ─────────────────────────────────────────────── */}
      {drilldown && (
        <DrilldownModal
          type={drilldown}
          onClose={() => setDrilldown(null)}
          giftRows={giftRows}
        />
      )}
    </div>
  );
}

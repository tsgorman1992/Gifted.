import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Gift, DollarSign, Clock, CheckCircle2, RefreshCw, LogOut,
  ExternalLink, Copy, Check, Users, BadgeCheck, X,
  TrendingUp, Percent, Repeat2, Sparkles, Search, Trash2,
  AlertTriangle, ChevronDown, ChevronUp, BarChart2,
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

const METHOD_LABELS: Record<string, string> = {
  venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle",
};
const METHOD_COLORS: Record<string, string> = {
  venmo: "#008CFF", cashapp: "#00D632", paypal: "#003087", zelle: "#6D1ED4",
};
const EXP_LABELS: Record<string, string> = {
  "confetti-burst": "Confetti Burst",
  "midnight-stars": "Midnight Stars",
  "golden-hour":    "Golden Hour",
  "ocean-breeze":   "Ocean Breeze",
  "rose-garden":    "Rose Garden",
  "aurora-dreams":  "Aurora Dreams",
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
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">Paid · Unsent</span>;
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
  const totalFee    = totalVolume * 0.05;

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
                ? `${feeRows.length} paid gift${feeRows.length !== 1 ? "s" : ""} · 5% platform fee`
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
                  <th className="text-right text-[11px] font-semibold text-green-700 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">Fee (5%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {feeRows.map(g => (
                  <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{g.recipientName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate hidden sm:table-cell">{g.senderName}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(amt(g))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">{fmt(amt(g) * 0.05)}</td>
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
  const [tab, setTab]           = useState<"cashouts" | "all" | "users" | "trends">("cashouts");
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

  const [showWipe, setShowWipe]   = useState(false);
  const [wipeInput, setWipeInput] = useState("");
  const [wiping, setWiping]       = useState(false);
  const [wipeMsg, setWipeMsg]     = useState<string | null>(null);

  const headers = { "x-admin-key": key };

  const loadTrends = useCallback(async () => {
    if (trendsLoaded) return;
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

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [key]);

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

  useEffect(() => { if (authed) load(); }, [authed, load]);

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
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-serif text-lg font-medium whitespace-nowrap">gifted.</h1>
            <span className="text-muted-foreground text-xs font-medium px-2 py-0.5 bg-muted rounded-full whitespace-nowrap">operator</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={load}
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
              <StatCard label="Fee revenue"  value={`$${stats.feeRevenue.toFixed(2)}`}  sub="5% of gross"                                icon={TrendingUp}  color="text-green-600"  onClick={() => setDrilldown("fee")} />
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

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-0 border-b border-border min-w-max px-4 sm:px-0 sm:min-w-0">
            {([
              ["cashouts", "Cashouts",  pendingCashouts.length > 0 ? String(pendingCashouts.length) : null, "amber"],
              ["all",      "All Gifts", String(giftRows.length), "muted"],
              ["users",    "Accounts",  String(userRows.length), "violet"],
              ["trends",   "Trends",    null,                    "none"],
            ] as const).map(([t, label, badge, badgeColor]) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t as typeof tab);
                  if (t === "trends") loadTrends();
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
                      <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">{g.recipientName}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground whitespace-nowrap">{g.senderName}</td>
                      <td className="px-3 sm:px-4 py-3 font-semibold text-primary whitespace-nowrap">{fmtAmt(g.amount)}</td>
                      <td className="px-3 sm:px-4 py-3"><StatusBadge gift={g} /></td>
                      <td className="px-3 sm:px-4 py-3 text-base">{g.reaction ?? ""}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{EXP_LABELS[g.experience] ?? g.experience}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <a href={`/open/${g.id}?preview=true`} target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1 block">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
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
